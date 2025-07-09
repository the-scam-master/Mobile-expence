// Smart Expense Tracker - Modern Clean App
class ExpenseTracker {
    constructor() {
        this.API_BASE_URL = '/api';
        this.expenses = [];
        this.budgets = [];
        this.currentView = 'home';
        this.chartColors = [
            '#6B7BD8', '#8B9AE8', '#A8B5EA', '#C5CFEC', 
            '#E1E8EE', '#B8D4F1', '#95C0ED', '#72ACE9'
        ];
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setCurrentDate();
        await this.loadData();
        this.updateDashboard();
        this.createExpenseChart();
    }

    setupEventListeners() {
        // Forms
        document.getElementById('expense-form').addEventListener('submit', this.handleAddExpense.bind(this));
        document.getElementById('budget-form').addEventListener('submit', this.handleAddBudget.bind(this));
        
        // Modal clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });
        
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                this.updateNavigation(item);
            });
        });
    }

    setCurrentDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('expense-date').value = today;
    }

    async loadData() {
        try {
            await Promise.all([
                this.loadExpenses(),
                this.loadBudgets()
            ]);
        } catch (error) {
            console.error('Error loading data:', error);
            this.showToast('Failed to load data', 'error');
        }
    }

    async loadExpenses() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/expenses`);
            if (response.ok) {
                this.expenses = await response.json();
            }
        } catch (error) {
            console.error('Error loading expenses:', error);
        }
    }

    async loadBudgets() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/budgets`);
            if (response.ok) {
                this.budgets = await response.json();
            }
        } catch (error) {
            console.error('Error loading budgets:', error);
        }
    }

    async handleAddExpense(e) {
        e.preventDefault();
        
        const expense = {
            name: document.getElementById('expense-name').value.trim(),
            amount: parseFloat(document.getElementById('expense-amount').value),
            date: document.getElementById('expense-date').value,
            category: document.getElementById('expense-category').value,
            description: document.getElementById('expense-description').value.trim() || ''
        };

        if (!expense.name || !expense.amount || !expense.date || !expense.category) {
            this.showToast('Please fill all required fields', 'error');
            return;
        }

        try {
            this.showLoading();
            const response = await fetch(`${this.API_BASE_URL}/expenses`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(expense),
            });

            if (response.ok) {
                const newExpense = await response.json();
                this.expenses.unshift(newExpense);
                this.updateDashboard();
                this.showToast('Expense added successfully!', 'success');
                e.target.reset();
                this.setCurrentDate();
                this.hideAddExpenseModal();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to add expense');
            }
        } catch (error) {
            console.error('Error adding expense:', error);
            this.showToast(error.message || 'Failed to add expense', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleAddBudget(e) {
        e.preventDefault();
        
        const budget = {
            category: document.getElementById('budget-category').value,
            amount: parseFloat(document.getElementById('budget-amount').value),
            period: document.getElementById('budget-period').value
        };

        if (!budget.category || !budget.amount) {
            this.showToast('Please fill all required fields', 'error');
            return;
        }

        try {
            this.showLoading();
            const response = await fetch(`${this.API_BASE_URL}/budgets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(budget),
            });

            if (response.ok) {
                const newBudget = await response.json();
                this.budgets.push(newBudget);
                this.updateBudgetAlerts();
                this.hideBudgetModal();
                this.showToast('Budget set successfully!', 'success');
                e.target.reset();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to set budget');
            }
        } catch (error) {
            console.error('Error setting budget:', error);
            this.showToast(error.message || 'Failed to set budget', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async deleteExpense(expenseId) {
        if (!confirm('Are you sure you want to delete this expense?')) {
            return;
        }

        try {
            this.showLoading();
            const response = await fetch(`${this.API_BASE_URL}/expenses/${expenseId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                this.expenses = this.expenses.filter(expense => expense.id !== expenseId);
                this.updateDashboard();
                this.showToast('Expense deleted successfully!', 'success');
            } else {
                throw new Error('Failed to delete expense');
            }
        } catch (error) {
            console.error('Error deleting expense:', error);
            this.showToast('Failed to delete expense', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async suggestCategory() {
        const expenseName = document.getElementById('expense-name').value.trim();
        const amount = parseFloat(document.getElementById('expense-amount').value);

        if (!expenseName || !amount) {
            this.showToast('Please enter expense name and amount first', 'error');
            return;
        }

        try {
            this.showLoading();
            const response = await fetch(`${this.API_BASE_URL}/expenses/categorize?expense_name=${encodeURIComponent(expenseName)}&amount=${amount}`);
            
            if (response.ok) {
                const data = await response.json();
                const categorySelect = document.getElementById('expense-category');
                categorySelect.value = data.suggested_category;
                this.showToast(`AI suggested: ${data.suggested_category}`, 'info');
            } else {
                throw new Error('Failed to get category suggestion');
            }
        } catch (error) {
            console.error('Error suggesting category:', error);
            this.showToast('Failed to get AI suggestion', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async getAIInsights() {
        if (this.expenses.length === 0) {
            this.showToast('Add some expenses to get AI insights', 'info');
            return;
        }

        try {
            this.showLoading();
            const response = await fetch(`${this.API_BASE_URL}/expenses/insights`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ expenses: this.expenses }),
            });

            if (response.ok) {
                const insights = await response.json();
                this.displayInsights(insights);
                this.showToast('AI insights updated!', 'success');
            } else {
                throw new Error('Failed to get insights');
            }
        } catch (error) {
            console.error('Error getting insights:', error);
            this.showToast('Failed to get AI insights', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async getFinancialHealth() {
        if (this.expenses.length === 0) {
            this.showToast('Add some expenses to get financial health score', 'info');
            return;
        }

        try {
            this.showLoading();
            const response = await fetch(`${this.API_BASE_URL}/financial-health`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    expenses: this.expenses,
                    budgets: this.budgets 
                }),
            });

            if (response.ok) {
                const healthData = await response.json();
                this.displayFinancialHealth(healthData);
                this.showToast('Financial health calculated!', 'success');
            } else {
                throw new Error('Failed to calculate financial health');
            }
        } catch (error) {
            console.error('Error calculating financial health:', error);
            this.showToast('Failed to calculate financial health', 'error');
        } finally {
            this.hideLoading();
        }
    }

    updateDashboard() {
        this.updateOverviewCards();
        this.updateRecentExpenses();
        this.updateBudgetAlerts();
        this.updateExpenseChart();
    }

    updateOverviewCards() {
        const totalExpenses = this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const currentMonth = new Date().toISOString().slice(0, 7);
        const monthlyExpenses = this.expenses
            .filter(expense => expense.date.startsWith(currentMonth))
            .reduce((sum, expense) => sum + expense.amount, 0);

        // Simulate total balance (in real app, this would come from actual account balance)
        const totalBalance = 25000 - totalExpenses;

        document.getElementById('total-balance').textContent = this.formatCurrency(totalBalance);
        document.getElementById('month-expense').textContent = this.formatCurrency(monthlyExpenses);
    }

    updateRecentExpenses() {
        const recentExpenses = this.expenses.slice(0, 5);
        const container = document.getElementById('recent-expenses');

        if (recentExpenses.length === 0) {
            container.innerHTML = this.renderEmptyState('💳', 'No expenses yet', 'Add your first expense to get started');
            return;
        }

        container.innerHTML = recentExpenses.map(expense => `
            <div class="expense-item">
                <div class="expense-icon">${this.getCategoryIcon(expense.category)}</div>
                <div class="expense-details">
                    <div class="expense-name">${expense.name}</div>
                    <div class="expense-meta">${expense.category} • ${this.formatDate(expense.date)}</div>
                </div>
                <div class="expense-amount">-${this.formatCurrency(expense.amount)}</div>
                <button class="expense-delete" onclick="app.deleteExpense('${expense.id}')">🗑️</button>
            </div>
        `).join('');
    }

    async updateBudgetAlerts() {
        if (this.budgets.length === 0) {
            document.getElementById('alerts-section').style.display = 'none';
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE_URL}/budget/alerts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    expenses: this.expenses, 
                    budgets: this.budgets 
                }),
            });

            if (response.ok) {
                const alerts = await response.json();
                this.displayBudgetAlerts(alerts);
            }
        } catch (error) {
            console.error('Error getting budget alerts:', error);
        }
    }

    displayBudgetAlerts(alerts) {
        const container = document.getElementById('alerts-container');
        const section = document.getElementById('alerts-section');

        if (alerts.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        container.innerHTML = alerts.map(alert => `
            <div class="alert-item ${alert.alert_type}">
                <div class="alert-header">
                    <span class="alert-category">${this.getCategoryIcon(alert.category)} ${alert.category}</span>
                    <span class="alert-percentage">${alert.percentage_used.toFixed(0)}%</span>
                </div>
                <div class="alert-progress">
                    <div class="alert-progress-fill" style="width: ${Math.min(alert.percentage_used, 100)}%"></div>
                </div>
                <div class="alert-message">
                    Spent ${this.formatCurrency(alert.spent_amount)} of ${this.formatCurrency(alert.budget_amount)} • ${alert.days_remaining} days remaining
                </div>
            </div>
        `).join('');
    }

    displayInsights(insights) {
        const container = document.getElementById('insights-container');
        const section = document.getElementById('insights-section');

        if (insights.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        container.innerHTML = insights.map(insight => `
            <div class="insight-item">
                <div class="insight-title">💡 AI Insight</div>
                <div class="insight-message">${insight.message}</div>
                <div class="insight-confidence">Confidence: ${(insight.confidence * 100).toFixed(0)}%</div>
            </div>
        `).join('');
    }

    displayFinancialHealth(healthData) {
        const container = document.getElementById('insights-container');
        const section = document.getElementById('insights-section');

        section.style.display = 'block';
        const healthHtml = `
            <div class="insight-item">
                <div class="insight-title">📊 Financial Health Score</div>
                <div class="insight-message">${healthData.message}</div>
                <div class="insight-confidence">Confidence: ${(healthData.confidence * 100).toFixed(0)}%</div>
            </div>
        `;

        container.innerHTML = healthHtml + container.innerHTML;
    }

    createExpenseChart() {
        const canvas = document.getElementById('expense-chart');
        const ctx = canvas.getContext('2d');
        
        // Calculate category breakdown
        const categoryData = this.getCategoryBreakdown();
        
        if (Object.keys(categoryData).length === 0) {
            // Show empty chart
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        this.drawDonutChart(ctx, categoryData, canvas.width, canvas.height);
        this.updateChartLegend(categoryData);
    }

    updateExpenseChart() {
        this.createExpenseChart();
    }

    getCategoryBreakdown() {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const monthlyExpenses = this.expenses.filter(expense => expense.date.startsWith(currentMonth));
        
        const categoryData = {};
        monthlyExpenses.forEach(expense => {
            categoryData[expense.category] = (categoryData[expense.category] || 0) + expense.amount;
        });

        return categoryData;
    }

    drawDonutChart(ctx, data, width, height) {
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 10;
        const innerRadius = radius * 0.6;

        const total = Object.values(data).reduce((sum, value) => sum + value, 0);
        let currentAngle = -Math.PI / 2;

        const categories = Object.keys(data);
        
        categories.forEach((category, index) => {
            const value = data[category];
            const angle = (value / total) * 2 * Math.PI;
            const color = this.chartColors[index % this.chartColors.length];

            // Draw arc
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + angle);
            ctx.arc(centerX, centerY, innerRadius, currentAngle + angle, currentAngle, true);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();

            currentAngle += angle;
        });

        // Update chart center text
        document.getElementById('chart-total').textContent = this.formatCurrency(total);
    }

    updateChartLegend(categoryData) {
        const container = document.getElementById('chart-legend');
        
        if (Object.keys(categoryData).length === 0) {
            container.innerHTML = '<div class="empty-state">No data available</div>';
            return;
        }

        const categories = Object.keys(categoryData);
        const total = Object.values(categoryData).reduce((sum, value) => sum + value, 0);

        container.innerHTML = categories.map((category, index) => {
            const amount = categoryData[category];
            const percentage = ((amount / total) * 100).toFixed(1);
            const color = this.chartColors[index % this.chartColors.length];

            return `
                <div class="legend-item">
                    <div class="legend-color" style="background-color: ${color}"></div>
                    <span class="legend-label">${category}</span>
                    <span class="legend-amount">${this.formatCurrency(amount)} (${percentage}%)</span>
                </div>
            `;
        }).join('');
    }

    // UI Methods
    showAddExpenseModal() {
        document.getElementById('add-expense-modal').classList.add('active');
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    hideAddExpenseModal() {
        document.getElementById('add-expense-modal').classList.remove('active');
    }

    hideBudgetModal() {
        document.getElementById('budget-modal').classList.remove('active');
    }

    showLoading() {
        document.getElementById('loading').classList.add('active');
    }

    hideLoading() {
        document.getElementById('loading').classList.remove('active');
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // Navigation Methods
    showHome() {
        this.currentView = 'home';
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.updateDashboard();
    }

    showExpenses() {
        this.currentView = 'expenses';
        this.showAllExpensesView();
    }

    showBudgets() {
        this.currentView = 'budgets';
        this.showBudgetModal();
    }

    showProfile() {
        this.currentView = 'profile';
        this.showProfileView();
    }

    showAllExpenses() {
        this.showAllExpensesView();
    }

    showAllExpensesView() {
        // Show all expenses in a clean view
        const container = document.getElementById('recent-expenses');
        if (this.expenses.length === 0) {
            container.innerHTML = this.renderEmptyState('💳', 'No expenses yet', 'Add your first expense to get started');
            return;
        }

        container.innerHTML = this.expenses.map(expense => `
            <div class="expense-item">
                <div class="expense-icon">${this.getCategoryIcon(expense.category)}</div>
                <div class="expense-details">
                    <div class="expense-name">${expense.name}</div>
                    <div class="expense-meta">${expense.category} • ${this.formatDate(expense.date)}</div>
                    ${expense.description ? `<div class="expense-description">${expense.description}</div>` : ''}
                </div>
                <div class="expense-amount">-${this.formatCurrency(expense.amount)}</div>
                <button class="expense-delete" onclick="app.deleteExpense('${expense.id}')">🗑️</button>
            </div>
        `).join('');
        
        this.showToast(`Showing all ${this.expenses.length} expenses`, 'info');
    }

    showProfileView() {
        // Show user profile/settings
        const totalExpenses = this.expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const avgDaily = totalExpenses / Math.max(this.expenses.length, 1);
        const categories = [...new Set(this.expenses.map(exp => exp.category))];
        
        const profileData = {
            totalExpenses: this.formatCurrency(totalExpenses),
            expenseCount: this.expenses.length,
            avgDaily: this.formatCurrency(avgDaily),
            categoriesUsed: categories.length,
            joinedDate: '2025-01-01' // Mock join date
        };
        
        // Create a simple profile display
        alert(`Profile Summary:
📊 Total Expenses: ${profileData.totalExpenses}
📈 Total Records: ${profileData.expenseCount}
💰 Avg Daily: ${profileData.avgDaily}
🏷️ Categories Used: ${profileData.categoriesUsed}
📅 Member Since: ${profileData.joinedDate}`);
    }

    showAnalytics() {
        this.getFinancialHealth();
        // Also show analytics data
        this.showAnalyticsView();
    }

    showAnalyticsView() {
        if (this.expenses.length === 0) {
            this.showToast('Add some expenses to view analytics', 'info');
            return;
        }

        // Calculate some analytics
        const categoryBreakdown = this.getCategoryBreakdown();
        const totalSpent = Object.values(categoryBreakdown).reduce((sum, amount) => sum + amount, 0);
        
        // Show analytics in an alert for now (could be a modal later)
        let analyticsText = '📊 Expense Analytics\n\n';
        analyticsText += `Total Spent: ${this.formatCurrency(totalSpent)}\n\n`;
        analyticsText += 'Category Breakdown:\n';
        
        Object.entries(categoryBreakdown).forEach(([category, amount]) => {
            const percentage = ((amount / totalSpent) * 100).toFixed(1);
            analyticsText += `${this.getCategoryIcon(category)} ${category}: ${this.formatCurrency(amount)} (${percentage}%)\n`;
        });
        
        alert(analyticsText);
    }

    showSettings() {
        // Show settings options
        const settingsMenu = `Settings Menu:
⚙️ App Settings
🔔 Notifications: Enabled
💱 Currency: INR (₹)
📊 Chart Style: Donut
🎨 Theme: Light
🔄 Auto-sync: On
📱 Version: 1.0.0`;
        
        alert(settingsMenu);
    }

    refreshInsights() {
        this.getAIInsights();
    }

    filterExpenses(period) {
        let filteredExpenses = [];
        const now = new Date();
        
        switch(period) {
            case 'week':
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                filteredExpenses = this.expenses.filter(exp => new Date(exp.date) >= weekAgo);
                break;
            case 'month':
                const monthStr = now.toISOString().slice(0, 7);
                filteredExpenses = this.expenses.filter(exp => exp.date.startsWith(monthStr));
                break;
            case 'year':
                const yearStr = now.getFullYear().toString();
                filteredExpenses = this.expenses.filter(exp => exp.date.startsWith(yearStr));
                break;
            default:
                filteredExpenses = this.expenses;
        }
        
        // Update chart with filtered data
        const categoryData = {};
        filteredExpenses.forEach(expense => {
            categoryData[expense.category] = (categoryData[expense.category] || 0) + expense.amount;
        });
        
        this.updateChartLegend(categoryData);
        this.drawDonutChart(document.getElementById('expense-chart').getContext('2d'), categoryData, 120, 120);
        
        this.showToast(`Filtered to ${period}: ${filteredExpenses.length} expenses`, 'info');
    }

    toggleCardMenu(cardType) {
        // Show card menu options
        const menuOptions = {
            balance: ['View Details', 'Set Goal', 'Export Data'],
            expense: ['View Details', 'Set Budget', 'Category Analysis']
        };
        
        const options = menuOptions[cardType] || ['Option 1', 'Option 2', 'Option 3'];
        const menu = `${cardType.charAt(0).toUpperCase() + cardType.slice(1)} Menu:\n${options.join('\n')}`;
        alert(menu);
    }

    updateNavigation(activeItem) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        activeItem.classList.add('active');
    }

    // Utility Methods
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    }

    getCategoryIcon(category) {
        const icons = {
            'Food': '🍽️',
            'Transportation': '🚗',
            'Bills': '📋',
            'Entertainment': '🎬',
            'Housing': '🏠',
            'Groceries': '🛒',
            'Health': '💊',
            'Education': '📚',
            'Personal Care': '🧴',
            'Savings': '💰',
            'Travel': '✈️',
            'Other': '📦'
        };
        return icons[category] || '📦';
    }

    renderEmptyState(icon, title, description) {
        return `
            <div class="empty-state">
                <div class="empty-icon">${icon}</div>
                <div class="empty-title">${title}</div>
                <div class="empty-description">${description}</div>
            </div>
        `;
    }
}

// Global functions for HTML onclick handlers
function showAddExpenseModal() {
    app.showAddExpenseModal();
}

function hideAddExpenseModal() {
    app.hideAddExpenseModal();
}

function showBudgetModal() {
    app.showBudgetModal();
}

function hideBudgetModal() {
    app.hideBudgetModal();
}

function suggestCategory() {
    app.suggestCategory();
}

function getAIInsights() {
    app.getAIInsights();
}

function refreshInsights() {
    app.refreshInsights();
}

function showHome() {
    app.showHome();
}

function showExpenses() {
    app.showExpenses();
}

function showBudgets() {
    app.showBudgets();
}

function showProfile() {
    app.showProfile();
}

function showAllExpenses() {
    app.showAllExpenses();
}

function showAnalytics() {
    app.showAnalytics();
}

function showSettings() {
    app.showSettings();
}

function filterExpenses(period) {
    app.filterExpenses(period);
}

function toggleCardMenu(cardType) {
    app.toggleCardMenu(cardType);
}

// Initialize the app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ExpenseTracker();
});