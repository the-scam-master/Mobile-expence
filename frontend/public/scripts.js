// Smart AI-Powered Expense Tracker
class ExpenseTracker {
    constructor() {
        this.API_BASE_URL = '/api';
        this.expenses = [];
        this.budgets = {};
        this.salary = {};
        this.predictions = {};
        this.currentView = 'dashboard';
        
        this.categoryIcons = {
            'Food & Dining': '🍽️',
            'Transportation': '🚗',
            'Bills & Utilities': '📋',
            'Entertainment': '🎬',
            'Shopping': '🛍️',
            'Groceries': '🛒',
            'Healthcare': '💊',
            'Education': '📚',
            'Travel': '✈️',
            'Personal Care': '🧴',
            'Investment': '💰',
            'Insurance': '🛡️',
            'Rent': '🏠',
            'Other': '📦'
        };
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setCurrentDate();
        await this.loadDashboardData();
        this.updateUI();
    }

    setupEventListeners() {
        // Forms
        document.getElementById('expense-form').addEventListener('submit', this.handleAddExpense.bind(this));
        document.getElementById('budget-form').addEventListener('submit', this.handleSetBudget.bind(this));
        document.getElementById('salary-form').addEventListener('submit', this.handleSetSalary.bind(this));
        
        // Modal clicks outside to close
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });
        
        // ESC key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    setCurrentDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('expense-date').value = today;
    }

    async loadDashboardData() {
        try {
            await Promise.all([
                this.loadExpenses(),
                this.loadBudgets(),
                this.loadSalary(),
                this.loadPrediction()
            ]);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
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

    async loadSalary() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/salary`);
            if (response.ok) {
                this.salary = await response.json();
            }
        } catch (error) {
            console.error('Error loading salary:', error);
        }
    }

    async loadPrediction() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/expenses/predict-month`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            if (response.ok) {
                this.predictions = await response.json();
            }
        } catch (error) {
            console.error('Error loading prediction:', error);
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

        if (!expense.name || !expense.amount || !expense.date) {
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
                this.updateUI();
                this.showToast('Expense added successfully!', 'success');
                this.resetExpenseForm();
                this.closeExpenseModal();
                
                // Refresh prediction after adding expense
                await this.loadPrediction();
                this.updatePredictionCard();
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

    async handleSetBudget(e) {
        e.preventDefault();
        
        const budgetAmount = parseFloat(document.getElementById('monthly-budget').value);
        
        if (!budgetAmount || budgetAmount <= 0) {
            this.showToast('Please enter a valid budget amount', 'error');
            return;
        }

        try {
            this.showLoading();
            const response = await fetch(`${this.API_BASE_URL}/budgets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ monthly: budgetAmount }),
            });

            if (response.ok) {
                this.budgets = await response.json();
                this.updateUI();
                this.showToast('Budget set successfully!', 'success');
                this.closeBudgetModal();
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

    async handleSetSalary(e) {
        e.preventDefault();
        
        const salaryAmount = parseFloat(document.getElementById('monthly-salary').value);
        
        if (!salaryAmount || salaryAmount <= 0) {
            this.showToast('Please enter a valid salary amount', 'error');
            return;
        }

        try {
            this.showLoading();
            const response = await fetch(`${this.API_BASE_URL}/salary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ monthly: salaryAmount }),
            });

            if (response.ok) {
                this.salary = await response.json();
                this.updateUI();
                this.showToast('Salary set successfully!', 'success');
                this.closeSalaryModal();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to set salary');
            }
        } catch (error) {
            console.error('Error setting salary:', error);
            this.showToast(error.message || 'Failed to set salary', 'error');
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
                this.updateUI();
                this.showToast('Expense deleted successfully!', 'success');
                
                // Refresh prediction after deleting expense
                await this.loadPrediction();
                this.updatePredictionCard();
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
            const response = await fetch(`${this.API_BASE_URL}/expenses/categorize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: expenseName, amount: amount }),
            });
            
            if (response.ok) {
                const data = await response.json();
                const categorySelect = document.getElementById('expense-category');
                categorySelect.value = data.category;
                this.showToast(`AI suggested: ${data.category}`, 'info');
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

    async getAIAnalysis() {
        if (this.expenses.length === 0) {
            this.showToast('Add some expenses to get AI analysis', 'info');
            return;
        }

        try {
            this.showLoading();
            const response = await fetch(`${this.API_BASE_URL}/expenses/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const analysis = await response.json();
                this.displayAIAnalysis(analysis);
                this.showToast('AI analysis updated!', 'success');
            } else {
                throw new Error('Failed to get AI analysis');
            }
        } catch (error) {
            console.error('Error getting AI analysis:', error);
            this.showToast('Failed to get AI analysis', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async showSavingsAdvice() {
        if (this.salary.monthly <= 0) {
            this.showToast('Please set your salary first to get savings advice', 'info');
            this.openSalaryModal();
            return;
        }

        try {
            this.showLoading();
            const response = await fetch(`${this.API_BASE_URL}/savings/allocate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const advice = await response.json();
                this.displaySavingsAdvice(advice);
                this.showToast('Savings advice updated!', 'success');
            } else {
                throw new Error('Failed to get savings advice');
            }
        } catch (error) {
            console.error('Error getting savings advice:', error);
            this.showToast('Failed to get savings advice', 'error');
        } finally {
            this.hideLoading();
        }
    }

    updateUI() {
        this.updateOverviewCards();
        this.updatePredictionCard();
        this.updateCategoryBreakdown();
        this.updateRecentExpenses();
    }

    updateOverviewCards() {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const monthlyExpenses = this.expenses.filter(expense => expense.date.startsWith(currentMonth));
        const totalSpent = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        
        // Update budget card
        const budgetAmount = this.budgets.monthly || 0;
        const budgetProgress = budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0;
        
        document.getElementById('budget-amount').textContent = this.formatCurrency(budgetAmount);
        document.getElementById('budget-spent').textContent = this.formatCurrency(totalSpent);
        document.getElementById('budget-remaining').textContent = this.formatCurrency(Math.max(0, budgetAmount - totalSpent)) + ' left';
        
        const progressFill = document.getElementById('budget-progress');
        progressFill.style.width = `${Math.min(budgetProgress, 100)}%`;
        
        // Change color based on budget usage
        if (budgetProgress > 90) {
            progressFill.style.background = 'linear-gradient(135deg, #f56565 0%, #e53e3e 100%)';
        } else if (budgetProgress > 70) {
            progressFill.style.background = 'linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)';
        } else {
            progressFill.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
        }
        
        // Update monthly spending card
        document.getElementById('monthly-spending').textContent = this.formatCurrency(totalSpent);
        document.getElementById('expense-count').textContent = `${monthlyExpenses.length} expenses`;
        
        const dailyAverage = monthlyExpenses.length > 0 ? totalSpent / new Date().getDate() : 0;
        document.getElementById('daily-average').textContent = this.formatCurrency(dailyAverage) + '/day';
    }

    updatePredictionCard() {
        const predictedAmount = this.predictions.predicted_total || 0;
        const confidence = this.predictions.confidence || 0;
        const message = this.predictions.message || 'No prediction available';
        
        document.getElementById('predicted-amount').textContent = this.formatCurrency(predictedAmount);
        document.getElementById('confidence-score').textContent = `${confidence}%`;
        document.getElementById('prediction-message').textContent = message;
    }

    updateCategoryBreakdown() {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const monthlyExpenses = this.expenses.filter(expense => expense.date.startsWith(currentMonth));
        
        const categoryBreakdown = {};
        const totalSpent = monthlyExpenses.reduce((sum, expense) => {
            categoryBreakdown[expense.category] = (categoryBreakdown[expense.category] || 0) + expense.amount;
            return sum + expense.amount;
        }, 0);

        const categoryGrid = document.getElementById('category-grid');
        
        if (Object.keys(categoryBreakdown).length === 0) {
            categoryGrid.innerHTML = this.getEmptyState('📊', 'No expenses yet', 'Start adding expenses to see breakdown');
            return;
        }

        categoryGrid.innerHTML = Object.entries(categoryBreakdown)
            .sort(([,a], [,b]) => b - a)
            .map(([category, amount]) => {
                const percentage = ((amount / totalSpent) * 100).toFixed(1);
                return `
                    <div class="category-item">
                        <div class="category-icon">${this.categoryIcons[category] || '📦'}</div>
                        <div class="category-name">${category}</div>
                        <div class="category-amount">${this.formatCurrency(amount)}</div>
                        <div class="category-percentage">${percentage}%</div>
                    </div>
                `;
            }).join('');
    }

    updateRecentExpenses() {
        const recentExpenses = this.expenses.slice(0, 10);
        const expenseList = document.getElementById('recent-expenses');

        if (recentExpenses.length === 0) {
            expenseList.innerHTML = this.getEmptyState('💳', 'No expenses yet', 'Add your first expense to get started');
            return;
        }

        expenseList.innerHTML = recentExpenses.map(expense => `
            <div class="expense-item">
                <div class="expense-icon">${this.categoryIcons[expense.category] || '📦'}</div>
                <div class="expense-details">
                    <div class="expense-name">${expense.name}</div>
                    <div class="expense-meta">
                        <span>${expense.category}</span>
                        <span>•</span>
                        <span>${this.formatDate(expense.date)}</span>
                    </div>
                </div>
                <div class="expense-amount">${this.formatCurrency(expense.amount)}</div>
                <div class="expense-actions">
                    <button class="expense-action delete" onclick="app.deleteExpense('${expense.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    displayAIAnalysis(analysis) {
        const container = document.getElementById('insights-container');
        
        let html = `
            <div class="insight-item">
                <div class="insight-title">
                    <i class="fas fa-chart-line"></i>
                    Financial Health Score: ${analysis.health_score}/100
                </div>
                <div class="insight-message">
                    ${analysis.insights.join('<br>')}
                </div>
                <div class="insight-recommendations">
                    <h4>Recommendations:</h4>
                    <ul class="recommendation-list">
                        ${analysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        document.getElementById('insights-section').style.display = 'block';
    }

    displaySavingsAdvice(advice) {
        const container = document.getElementById('insights-container');
        
        let html = `
            <div class="insight-item">
                <div class="insight-title">
                    <i class="fas fa-piggy-bank"></i>
                    Savings Allocation Advice
                </div>
                <div class="insight-message">
                    ${advice.message}
                </div>
                <div class="insight-recommendations">
                    <h4>Suggested Allocations:</h4>
                    <ul class="recommendation-list">
                        ${advice.suggestions.map(suggestion => `
                            <li>
                                <strong>${suggestion.type}:</strong> ${this.formatCurrency(suggestion.amount)}
                                <br><small>${suggestion.description}</small>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        document.getElementById('insights-section').style.display = 'block';
    }

    // Modal Management
    openExpenseModal() {
        this.setCurrentDate();
        document.getElementById('expense-modal').classList.add('active');
    }

    closeExpenseModal() {
        document.getElementById('expense-modal').classList.remove('active');
    }

    openBudgetModal() {
        document.getElementById('monthly-budget').value = this.budgets.monthly || '';
        document.getElementById('budget-modal').classList.add('active');
    }

    closeBudgetModal() {
        document.getElementById('budget-modal').classList.remove('active');
    }

    openSalaryModal() {
        document.getElementById('monthly-salary').value = this.salary.monthly || '';
        document.getElementById('salary-modal').classList.add('active');
    }

    closeSalaryModal() {
        document.getElementById('salary-modal').classList.remove('active');
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    // Navigation
    showDashboard() {
        this.currentView = 'dashboard';
        this.updateNavigation();
        this.updateUI();
    }

    showExpenses() {
        this.currentView = 'expenses';
        this.updateNavigation();
        this.showAllExpenses();
    }

    showAnalytics() {
        this.currentView = 'analytics';
        this.updateNavigation();
        this.getAIAnalysis();
    }

    showProfile() {
        this.currentView = 'profile';
        this.updateNavigation();
        this.showProfileInfo();
    }

    showAllExpenses() {
        const expenseList = document.getElementById('recent-expenses');
        
        if (this.expenses.length === 0) {
            expenseList.innerHTML = this.getEmptyState('💳', 'No expenses yet', 'Add your first expense to get started');
            return;
        }

        expenseList.innerHTML = this.expenses.map(expense => `
            <div class="expense-item">
                <div class="expense-icon">${this.categoryIcons[expense.category] || '📦'}</div>
                <div class="expense-details">
                    <div class="expense-name">${expense.name}</div>
                    <div class="expense-meta">
                        <span>${expense.category}</span>
                        <span>•</span>
                        <span>${this.formatDate(expense.date)}</span>
                    </div>
                    ${expense.description ? `<div class="expense-description">${expense.description}</div>` : ''}
                </div>
                <div class="expense-amount">${this.formatCurrency(expense.amount)}</div>
                <div class="expense-actions">
                    <button class="expense-action delete" onclick="app.deleteExpense('${expense.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    showProfileInfo() {
        const totalExpenses = this.expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const categories = [...new Set(this.expenses.map(exp => exp.category))];
        
        const profileInfo = `
            <div class="insight-item">
                <div class="insight-title">
                    <i class="fas fa-user"></i>
                    Profile Summary
                </div>
                <div class="insight-message">
                    <strong>Total Expenses:</strong> ${this.formatCurrency(totalExpenses)}<br>
                    <strong>Total Records:</strong> ${this.expenses.length}<br>
                    <strong>Categories Used:</strong> ${categories.length}<br>
                    <strong>Monthly Salary:</strong> ${this.formatCurrency(this.salary.monthly || 0)}<br>
                    <strong>Monthly Budget:</strong> ${this.formatCurrency(this.budgets.monthly || 0)}
                </div>
            </div>
        `;
        
        document.getElementById('insights-container').innerHTML = profileInfo;
        document.getElementById('insights-section').style.display = 'block';
    }

    updateNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.querySelector(`[onclick="app.show${this.currentView.charAt(0).toUpperCase() + this.currentView.slice(1)}()"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }

    // Utility Methods
    resetExpenseForm() {
        document.getElementById('expense-form').reset();
        this.setCurrentDate();
    }

    showLoading() {
        document.getElementById('loading-overlay').classList.add('active');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.remove('active');
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
            day: 'numeric',
            year: 'numeric'
        });
    }

    getEmptyState(icon, title, description) {
        return `
            <div class="empty-state">
                <i class="fas fa-${icon === '📊' ? 'chart-pie' : icon === '💳' ? 'credit-card' : 'info-circle'}"></i>
                <h3>${title}</h3>
                <p>${description}</p>
            </div>
        `;
    }

    // Additional utility methods
    toggleCategoryView() {
        const categoryGrid = document.getElementById('category-grid');
        const button = document.querySelector('.toggle-btn');
        
        if (categoryGrid.style.display === 'none') {
            categoryGrid.style.display = 'grid';
            button.innerHTML = '<i class="fas fa-compress"></i>';
        } else {
            categoryGrid.style.display = 'none';
            button.innerHTML = '<i class="fas fa-expand"></i>';
        }
    }

    showMonthlyView() {
        this.showToast('Monthly view - showing current month data', 'info');
        this.updateUI();
    }

    refreshInsights() {
        this.getAIAnalysis();
    }

    openSettingsModal() {
        this.showToast('Settings coming soon!', 'info');
    }
}

// Global functions for HTML onclick handlers
let app;

function openExpenseModal() {
    app.openExpenseModal();
}

function closeExpenseModal() {
    app.closeExpenseModal();
}

function openBudgetModal() {
    app.openBudgetModal();
}

function closeBudgetModal() {
    app.closeBudgetModal();
}

function openSalaryModal() {
    app.openSalaryModal();
}

function closeSalaryModal() {
    app.closeSalaryModal();
}

function suggestCategory() {
    app.suggestCategory();
}

function getAIAnalysis() {
    app.getAIAnalysis();
}

function showSavingsAdvice() {
    app.showSavingsAdvice();
}

function showDashboard() {
    app.showDashboard();
}

function showExpenses() {
    app.showExpenses();
}

function showAnalytics() {
    app.showAnalytics();
}

function showProfile() {
    app.showProfile();
}

function showAllExpenses() {
    app.showAllExpenses();
}

function toggleCategoryView() {
    app.toggleCategoryView();
}

function showMonthlyView() {
    app.showMonthlyView();
}

function refreshInsights() {
    app.refreshInsights();
}

function openSettingsModal() {
    app.openSettingsModal();
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    app = new ExpenseTracker();
});
