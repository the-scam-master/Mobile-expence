from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
import uuid
from typing import Dict, List, Any, Optional
import google.generativeai as genai
from concurrent.futures import ThreadPoolExecutor
import threading
import re

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Thread pool for AI operations
executor = ThreadPoolExecutor(max_workers=4)

# Data storage paths
DATA_DIR = Path(__file__).parent / 'data'
DATA_DIR.mkdir(exist_ok=True)

EXPENSES_FILE = DATA_DIR / 'expenses.json'
BUDGETS_FILE = DATA_DIR / 'budgets.json'
SALARY_FILE = DATA_DIR / 'salary.json'
PREDICTIONS_FILE = DATA_DIR / 'predictions.json'

# AI Configuration
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY', '')
AI_ENABLED = False

if GOOGLE_API_KEY and GOOGLE_API_KEY != 'your_google_api_key_here':
    try:
        genai.configure(api_key=GOOGLE_API_KEY)
        AI_ENABLED = True
        logger.info("AI service enabled with Google Gemini")
    except Exception as e:
        logger.error(f"Failed to configure AI service: {e}")
        AI_ENABLED = False
else:
    logger.info("AI service disabled - no API key provided")

# Data Models
class ExpenseTracker:
    def __init__(self):
        self.expenses = self.load_expenses()
        self.budgets = self.load_budgets()
        self.salary = self.load_salary()
        self.predictions = self.load_predictions()
    
    def load_expenses(self) -> List[Dict]:
        try:
            if EXPENSES_FILE.exists():
                with open(EXPENSES_FILE, 'r') as f:
                    return json.load(f)
            return []
        except Exception as e:
            logger.error(f"Error loading expenses: {e}")
            return []
    
    def save_expenses(self):
        try:
            with open(EXPENSES_FILE, 'w') as f:
                json.dump(self.expenses, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error saving expenses: {e}")
    
    def load_budgets(self) -> Dict:
        try:
            if BUDGETS_FILE.exists():
                with open(BUDGETS_FILE, 'r') as f:
                    return json.load(f)
            return {
                "monthly": 0,
                "categories": {},
                "created_at": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error loading budgets: {e}")
            return {"monthly": 0, "categories": {}, "created_at": datetime.now().isoformat()}
    
    def save_budgets(self):
        try:
            with open(BUDGETS_FILE, 'w') as f:
                json.dump(self.budgets, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error saving budgets: {e}")
    
    def load_salary(self) -> Dict:
        try:
            if SALARY_FILE.exists():
                with open(SALARY_FILE, 'r') as f:
                    return json.load(f)
            return {
                "monthly": 0,
                "currency": "₹",
                "created_at": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error loading salary: {e}")
            return {"monthly": 0, "currency": "₹", "created_at": datetime.now().isoformat()}
    
    def save_salary(self):
        try:
            with open(SALARY_FILE, 'w') as f:
                json.dump(self.salary, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error saving salary: {e}")
    
    def load_predictions(self) -> Dict:
        try:
            if PREDICTIONS_FILE.exists():
                with open(PREDICTIONS_FILE, 'r') as f:
                    return json.load(f)
            return {
                "current_month": 0,
                "confidence": 0,
                "last_updated": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error loading predictions: {e}")
            return {"current_month": 0, "confidence": 0, "last_updated": datetime.now().isoformat()}
    
    def save_predictions(self):
        try:
            with open(PREDICTIONS_FILE, 'w') as f:
                json.dump(self.predictions, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error saving predictions: {e}")

# Initialize tracker
tracker = ExpenseTracker()

# AI Service
class AIService:
    def __init__(self):
        self.model = None
        if AI_ENABLED:
            try:
                self.model = genai.GenerativeModel('gemini-pro')
                logger.info("AI model initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize AI model: {e}")
                self.model = None
    
    def categorize_expense(self, expense_name: str, amount: float) -> str:
        """Auto-categorize expense using AI or rule-based fallback"""
        if self.model and AI_ENABLED:
            try:
                categories = [
                    "Food & Dining", "Transportation", "Bills & Utilities", 
                    "Entertainment", "Shopping", "Groceries", "Healthcare", 
                    "Education", "Travel", "Personal Care", "Investment", 
                    "Insurance", "Rent", "Other"
                ]
                
                prompt = f"""
                Categorize this expense into one of these categories: {', '.join(categories)}
                
                Expense: "{expense_name}"
                Amount: ₹{amount}
                
                Respond with only the category name that best fits this expense.
                Consider Indian context and spending patterns.
                """
                
                response = self.model.generate_content(prompt)
                category = response.text.strip()
                
                if category in categories:
                    return category
                else:
                    return self._fallback_categorization(expense_name, amount)
            except Exception as e:
                logger.error(f"AI categorization failed: {e}")
                return self._fallback_categorization(expense_name, amount)
        else:
            return self._fallback_categorization(expense_name, amount)
    
    def _fallback_categorization(self, expense_name: str, amount: float) -> str:
        """Rule-based categorization fallback"""
        name_lower = expense_name.lower()
        
        food_keywords = ['food', 'restaurant', 'cafe', 'coffee', 'lunch', 'dinner', 'breakfast', 'pizza', 'burger']
        transport_keywords = ['uber', 'taxi', 'bus', 'metro', 'petrol', 'fuel', 'parking']
        bills_keywords = ['electricity', 'water', 'gas', 'internet', 'phone', 'mobile', 'recharge']
        grocery_keywords = ['grocery', 'supermarket', 'vegetables', 'fruits', 'milk', 'bread']
        entertainment_keywords = ['movie', 'cinema', 'game', 'music', 'spotify', 'netflix']
        
        if any(keyword in name_lower for keyword in food_keywords):
            return "Food & Dining"
        elif any(keyword in name_lower for keyword in transport_keywords):
            return "Transportation"
        elif any(keyword in name_lower for keyword in bills_keywords):
            return "Bills & Utilities"
        elif any(keyword in name_lower for keyword in grocery_keywords):
            return "Groceries"
        elif any(keyword in name_lower for keyword in entertainment_keywords):
            return "Entertainment"
        elif amount > 10000:
            return "Investment"
        else:
            return "Other"
    
    def analyze_spending(self, expenses: List[Dict], salary: Dict) -> Dict:
        """Analyze spending patterns and provide insights"""
        if not expenses:
            return {
                "insights": ["No expenses to analyze yet. Start adding your expenses!"],
                "recommendations": ["Add your first expense to get personalized insights"],
                "health_score": 50
            }
        
        # Calculate basic metrics
        total_spent = sum(exp['amount'] for exp in expenses)
        monthly_salary = salary.get('monthly', 0)
        
        # Category breakdown
        category_spending = {}
        for exp in expenses:
            category = exp['category']
            category_spending[category] = category_spending.get(category, 0) + exp['amount']
        
        # Generate insights
        insights = []
        recommendations = []
        
        # Spending vs Income analysis
        if monthly_salary > 0:
            spending_ratio = (total_spent / monthly_salary) * 100
            if spending_ratio > 90:
                insights.append(f"⚠️ High spending alert: You've spent {spending_ratio:.1f}% of your monthly income")
                recommendations.append("Consider reducing discretionary spending and focus on essentials")
            elif spending_ratio > 70:
                insights.append(f"⚡ Moderate spending: {spending_ratio:.1f}% of monthly income used")
                recommendations.append("Good spending control, but watch for any unnecessary expenses")
            else:
                insights.append(f"✅ Healthy spending: {spending_ratio:.1f}% of monthly income used")
                recommendations.append("Great job maintaining spending discipline!")
        
        # Top spending category
        if category_spending:
            top_category = max(category_spending.items(), key=lambda x: x[1])
            insights.append(f"💰 Highest spending category: {top_category[0]} (₹{top_category[1]:,.0f})")
            
            if top_category[1] > total_spent * 0.4:
                recommendations.append(f"Consider reviewing {top_category[0]} expenses for potential savings")
        
        # Calculate health score
        health_score = 50
        if monthly_salary > 0:
            if spending_ratio < 50:
                health_score = 90
            elif spending_ratio < 70:
                health_score = 75
            elif spending_ratio < 90:
                health_score = 60
            else:
                health_score = 30
        
        return {
            "insights": insights,
            "recommendations": recommendations,
            "health_score": health_score,
            "spending_ratio": spending_ratio if monthly_salary > 0 else 0,
            "top_category": top_category[0] if category_spending else "None"
        }
    
    def predict_current_month(self, expenses: List[Dict], salary: Dict) -> Dict:
        """Predict current month spending based on patterns"""
        current_month = datetime.now().strftime('%Y-%m')
        current_month_expenses = [exp for exp in expenses if exp['date'].startswith(current_month)]
        
        if not current_month_expenses:
            return {
                "predicted_total": 0,
                "confidence": 0,
                "message": "No expenses this month yet. Add some expenses to get predictions!"
            }
        
        # Calculate spending velocity
        today = datetime.now().day
        days_in_month = (datetime.now().replace(month=datetime.now().month % 12 + 1, day=1) - timedelta(days=1)).day
        days_remaining = days_in_month - today
        
        current_spent = sum(exp['amount'] for exp in current_month_expenses)
        daily_average = current_spent / today if today > 0 else 0
        
        # Predict based on different methods
        velocity_prediction = current_spent + (daily_average * days_remaining)
        
        # Historical pattern analysis
        historical_months = {}
        for exp in expenses:
            month = exp['date'][:7]
            if month != current_month:
                historical_months[month] = historical_months.get(month, 0) + exp['amount']
        
        historical_average = sum(historical_months.values()) / len(historical_months) if historical_months else velocity_prediction
        
        # Weighted prediction
        if len(historical_months) >= 2:
            predicted_total = (velocity_prediction * 0.6) + (historical_average * 0.4)
            confidence = min(85, 40 + (len(historical_months) * 5))
        else:
            predicted_total = velocity_prediction
            confidence = min(60, 20 + (today * 2))
        
        return {
            "predicted_total": round(predicted_total, 2),
            "confidence": confidence,
            "current_spent": current_spent,
            "days_remaining": days_remaining,
            "daily_average": round(daily_average, 2),
            "message": f"Based on current spending patterns, you're likely to spend ₹{predicted_total:,.0f} this month"
        }
    
    def suggest_savings_allocation(self, expenses: List[Dict], salary: Dict, budgets: Dict) -> Dict:
        """Suggest optimal savings allocation based on income and spending"""
        monthly_salary = salary.get('monthly', 0)
        
        if monthly_salary <= 0:
            return {
                "message": "Please set your monthly salary to get savings recommendations",
                "suggestions": []
            }
        
        # Calculate current spending
        current_month = datetime.now().strftime('%Y-%m')
        current_expenses = [exp for exp in expenses if exp['date'].startswith(current_month)]
        current_spent = sum(exp['amount'] for exp in current_expenses)
        
        # Suggest allocation based on 50-30-20 rule
        needs_allocation = monthly_salary * 0.5  # 50% for needs
        wants_allocation = monthly_salary * 0.3  # 30% for wants
        savings_target = monthly_salary * 0.2    # 20% for savings
        
        suggestions = []
        
        # Emergency fund suggestion
        emergency_fund = monthly_salary * 6
        suggestions.append({
            "type": "Emergency Fund",
            "amount": emergency_fund,
            "monthly_target": emergency_fund / 12,
            "description": "Build 6 months of expenses as emergency fund"
        })
        
        # Investment suggestions
        if current_spent < needs_allocation:
            extra_savings = needs_allocation - current_spent
            suggestions.append({
                "type": "Additional Investment",
                "amount": extra_savings,
                "monthly_target": extra_savings,
                "description": "You're spending less than budgeted for needs. Consider investing the surplus"
            })
        
        # Category-wise budget suggestions
        category_budgets = {
            "Food & Dining": monthly_salary * 0.15,
            "Transportation": monthly_salary * 0.10,
            "Bills & Utilities": monthly_salary * 0.10,
            "Entertainment": monthly_salary * 0.05,
            "Shopping": monthly_salary * 0.05,
            "Healthcare": monthly_salary * 0.05
        }
        
        return {
            "message": f"Based on your ₹{monthly_salary:,.0f} monthly income, here are optimization suggestions:",
            "savings_target": savings_target,
            "current_savings": max(0, monthly_salary - current_spent),
            "suggestions": suggestions,
            "category_budgets": category_budgets
        }

# Initialize AI service
ai_service = AIService()

# API Routes
@app.route('/api/', methods=['GET'])
def root():
    return jsonify({
        "message": "Smart Expense Tracker API",
        "ai_enabled": AI_ENABLED,
        "version": "1.0.0"
    })

@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    try:
        return jsonify(tracker.expenses)
    except Exception as e:
        logger.error(f"Error getting expenses: {e}")
        return jsonify({"error": "Failed to get expenses"}), 500

@app.route('/api/expenses', methods=['POST'])
def add_expense():
    try:
        data = request.json
        
        # Validate required fields
        if not data.get('name') or not data.get('amount'):
            return jsonify({"error": "Name and amount are required"}), 400
        
        # Create expense object
        expense = {
            "id": str(uuid.uuid4()),
            "name": data['name'],
            "amount": float(data['amount']),
            "category": data.get('category', 'Other'),
            "date": data.get('date', datetime.now().strftime('%Y-%m-%d')),
            "description": data.get('description', ''),
            "created_at": datetime.now().isoformat()
        }
        
        # Auto-categorize if category not provided or is 'Other'
        if not data.get('category') or data.get('category') == 'Other':
            expense['category'] = ai_service.categorize_expense(expense['name'], expense['amount'])
        
        tracker.expenses.append(expense)
        tracker.save_expenses()
        
        return jsonify(expense), 201
    except Exception as e:
        logger.error(f"Error adding expense: {e}")
        return jsonify({"error": "Failed to add expense"}), 500

@app.route('/api/expenses/<expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    try:
        tracker.expenses = [exp for exp in tracker.expenses if exp['id'] != expense_id]
        tracker.save_expenses()
        return jsonify({"message": "Expense deleted successfully"})
    except Exception as e:
        logger.error(f"Error deleting expense: {e}")
        return jsonify({"error": "Failed to delete expense"}), 500

@app.route('/api/budgets', methods=['GET'])
def get_budgets():
    try:
        return jsonify(tracker.budgets)
    except Exception as e:
        logger.error(f"Error getting budgets: {e}")
        return jsonify({"error": "Failed to get budgets"}), 500

@app.route('/api/budgets', methods=['POST'])
def set_budget():
    try:
        data = request.json
        
        if 'monthly' in data:
            tracker.budgets['monthly'] = float(data['monthly'])
        
        if 'categories' in data:
            tracker.budgets['categories'].update(data['categories'])
        
        tracker.budgets['updated_at'] = datetime.now().isoformat()
        tracker.save_budgets()
        
        return jsonify(tracker.budgets)
    except Exception as e:
        logger.error(f"Error setting budget: {e}")
        return jsonify({"error": "Failed to set budget"}), 500

@app.route('/api/salary', methods=['GET'])
def get_salary():
    try:
        return jsonify(tracker.salary)
    except Exception as e:
        logger.error(f"Error getting salary: {e}")
        return jsonify({"error": "Failed to get salary"}), 500

@app.route('/api/salary', methods=['POST'])
def set_salary():
    try:
        data = request.json
        
        if 'monthly' in data:
            tracker.salary['monthly'] = float(data['monthly'])
        
        if 'currency' in data:
            tracker.salary['currency'] = data['currency']
        
        tracker.salary['updated_at'] = datetime.now().isoformat()
        tracker.save_salary()
        
        return jsonify(tracker.salary)
    except Exception as e:
        logger.error(f"Error setting salary: {e}")
        return jsonify({"error": "Failed to set salary"}), 500

@app.route('/api/expenses/categorize', methods=['POST'])
def categorize_expense():
    try:
        data = request.json
        name = data.get('name', '')
        amount = float(data.get('amount', 0))
        
        if not name or amount <= 0:
            return jsonify({"error": "Valid name and amount required"}), 400
        
        category = ai_service.categorize_expense(name, amount)
        return jsonify({"category": category})
    except Exception as e:
        logger.error(f"Error categorizing expense: {e}")
        return jsonify({"error": "Failed to categorize expense"}), 500

@app.route('/api/expenses/analyze', methods=['POST'])
def analyze_spending():
    try:
        analysis = ai_service.analyze_spending(tracker.expenses, tracker.salary)
        return jsonify(analysis)
    except Exception as e:
        logger.error(f"Error analyzing spending: {e}")
        return jsonify({"error": "Failed to analyze spending"}), 500

@app.route('/api/expenses/predict-month', methods=['POST'])
def predict_current_month():
    try:
        prediction = ai_service.predict_current_month(tracker.expenses, tracker.salary)
        
        # Save prediction
        tracker.predictions.update(prediction)
        tracker.predictions['last_updated'] = datetime.now().isoformat()
        tracker.save_predictions()
        
        return jsonify(prediction)
    except Exception as e:
        logger.error(f"Error predicting month: {e}")
        return jsonify({"error": "Failed to predict month"}), 500

@app.route('/api/savings/allocate', methods=['POST'])
def suggest_savings():
    try:
        suggestions = ai_service.suggest_savings_allocation(tracker.expenses, tracker.salary, tracker.budgets)
        return jsonify(suggestions)
    except Exception as e:
        logger.error(f"Error suggesting savings: {e}")
        return jsonify({"error": "Failed to suggest savings"}), 500

@app.route('/api/financial-health', methods=['GET'])
def get_financial_health():
    try:
        # Get comprehensive financial health analysis
        analysis = ai_service.analyze_spending(tracker.expenses, tracker.salary)
        prediction = ai_service.predict_current_month(tracker.expenses, tracker.salary)
        
        # Calculate additional metrics
        monthly_salary = tracker.salary.get('monthly', 0)
        current_month = datetime.now().strftime('%Y-%m')
        current_expenses = [exp for exp in tracker.expenses if exp['date'].startswith(current_month)]
        current_spent = sum(exp['amount'] for exp in current_expenses)
        
        savings_rate = ((monthly_salary - current_spent) / monthly_salary * 100) if monthly_salary > 0 else 0
        
        health_data = {
            "health_score": analysis["health_score"],
            "spending_ratio": analysis.get("spending_ratio", 0),
            "savings_rate": max(0, savings_rate),
            "predicted_spending": prediction["predicted_total"],
            "current_spending": current_spent,
            "monthly_income": monthly_salary,
            "insights": analysis["insights"],
            "recommendations": analysis["recommendations"],
            "top_category": analysis.get("top_category", "None")
        }
        
        return jsonify(health_data)
    except Exception as e:
        logger.error(f"Error getting financial health: {e}")
        return jsonify({"error": "Failed to get financial health"}), 500

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard_data():
    try:
        # Get comprehensive dashboard data
        current_month = datetime.now().strftime('%Y-%m')
        current_expenses = [exp for exp in tracker.expenses if exp['date'].startswith(current_month)]
        current_spent = sum(exp['amount'] for exp in current_expenses)
        
        # Category breakdown
        category_breakdown = {}
        for exp in current_expenses:
            category = exp['category']
            category_breakdown[category] = category_breakdown.get(category, 0) + exp['amount']
        
        # Budget progress
        monthly_budget = tracker.budgets.get('monthly', 0)
        budget_progress = (current_spent / monthly_budget * 100) if monthly_budget > 0 else 0
        
        # Recent expenses (last 10)
        recent_expenses = sorted(tracker.expenses, key=lambda x: x['created_at'], reverse=True)[:10]
        
        dashboard = {
            "current_spending": current_spent,
            "monthly_budget": monthly_budget,
            "budget_progress": min(100, budget_progress),
            "monthly_salary": tracker.salary.get('monthly', 0),
            "expenses_count": len(current_expenses),
            "category_breakdown": category_breakdown,
            "recent_expenses": recent_expenses,
            "ai_enabled": AI_ENABLED
        }
        
        return jsonify(dashboard)
    except Exception as e:
        logger.error(f"Error getting dashboard data: {e}")
        return jsonify({"error": "Failed to get dashboard data"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8001, debug=True)
