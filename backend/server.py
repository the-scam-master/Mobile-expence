from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from pydantic import BaseModel, Field, ValidationError
from typing import List, Optional, Dict, Any
import os
import logging
from pathlib import Path
import google.generativeai as genai
import json
from datetime import datetime, timedelta
import uuid
import asyncio
import nest_asyncio
import threading
from concurrent.futures import ThreadPoolExecutor

# Enable nested event loops for async operations
nest_asyncio.apply()

# Initialize logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Data Models
class Expense(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    amount: float
    date: str
    category: str
    description: Optional[str] = ""
    created_at: datetime = Field(default_factory=datetime.now)

class Budget(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: str
    amount: float
    period: str = "monthly"
    created_at: datetime = Field(default_factory=datetime.now)

class ExpenseAnalytics(BaseModel):
    total_expenses: float
    category_breakdown: Dict[str, float]
    monthly_trend: List[Dict[str, Any]]
    average_daily_spend: float
    highest_spending_category: str
    spending_growth: float

class AIInsight(BaseModel):
    type: str
    message: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    data: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.now)

class BudgetAlert(BaseModel):
    category: str
    budget_amount: float
    spent_amount: float
    percentage_used: float = Field(..., ge=0.0)
    alert_type: str
    days_remaining: int

# Configure Google Gemini
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY', '')
if not GOOGLE_API_KEY or GOOGLE_API_KEY == 'your_google_api_key_here':
    logger.warning("GOOGLE_API_KEY is not set or using placeholder. AI features will be limited.")
    AI_ENABLED = False
else:
    try:
        genai.configure(api_key=GOOGLE_API_KEY)
        logger.info("Google Generative AI configured successfully.")
        AI_ENABLED = True
    except Exception as e:
        logger.error(f"Failed to configure Google Generative AI: {e}")
        AI_ENABLED = False

# Create Flask app
app = Flask(__name__)
CORS(app)

# Thread pool for AI operations
executor = ThreadPoolExecutor(max_workers=4)

# In-memory storage (replace with MongoDB in production)
expenses_db = []
budgets_db = []

# Sample data for demo
sample_expenses = [
    {
        "id": str(uuid.uuid4()),
        "name": "Morning Coffee",
        "amount": 120.0,
        "date": "2025-01-09",
        "category": "Food",
        "description": "Daily coffee from cafe",
        "created_at": datetime.now()
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Bus Fare",
        "amount": 50.0,
        "date": "2025-01-09",
        "category": "Transportation",
        "description": "Public transport",
        "created_at": datetime.now()
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Lunch",
        "amount": 200.0,
        "date": "2025-01-08",
        "category": "Food",
        "description": "Office lunch",
        "created_at": datetime.now()
    }
]

# Add sample data to expenses_db
for expense_data in sample_expenses:
    try:
        expense = Expense(**expense_data)
        expenses_db.append(expense)
    except:
        pass  # Skip invalid sample data

# Data Models
class Expense(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    amount: float
    date: str
    category: str
    description: Optional[str] = ""
    created_at: datetime = Field(default_factory=datetime.now)

class Budget(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: str
    amount: float
    period: str = "monthly"
    created_at: datetime = Field(default_factory=datetime.now)

class ExpenseAnalytics(BaseModel):
    total_expenses: float
    category_breakdown: Dict[str, float]
    monthly_trend: List[Dict[str, Any]]
    average_daily_spend: float
    highest_spending_category: str
    spending_growth: float

class AIInsight(BaseModel):
    type: str
    message: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    data: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.now)

class BudgetAlert(BaseModel):
    category: str
    budget_amount: float
    spent_amount: float
    percentage_used: float = Field(..., ge=0.0)
    alert_type: str
    days_remaining: int

# AI Service Class
class AIExpenseService:
    def __init__(self):
        self.model = None
        if GOOGLE_API_KEY:
            try:
                self.model = genai.GenerativeModel('gemma-3-27b-it')
                logger.info("AI model 'gemma-3-27b-it' initialized.")
            except Exception as e:
                logger.error(f"Failed to initialize AI model: {e}")

    def predict_next_month_expenses(self, expenses: List[Expense]) -> AIInsight:
        """Predict next month's expenses using AI"""
        if not self.model:
            logger.warning("AI model not available for prediction.")
            return AIInsight(type="prediction", message="AI service not available.", confidence=0.0)
        
        try:
            recent_expenses = [exp for exp in expenses if datetime.strptime(exp.date, '%Y-%m-%d') >= datetime.now() - timedelta(days=90)]
            if not recent_expenses:
                logger.info("Not enough recent expense data for AI prediction.")
                return AIInsight(type="prediction", message="Not enough recent expense data for accurate prediction.", confidence=0.1)

            expense_data_str = json.dumps([exp.model_dump() for exp in recent_expenses], indent=2, default=str)
            prompt = f"""
            You are an expert financial analyst. Analyze the provided recent expense data (up to last 90 days) to predict next month's spending patterns and suggest improvements.
            The currency for all amounts is Indian Rupees (₹).
            
            Recent Expense Data:
            {expense_data_str}
            
            Provide a comprehensive analysis in STRICT JSON format:
            {{
              "predicted_total": float,
              "category_breakdown": {{"Food": float, "Transportation": float, "Bills": float, "Entertainment": float, "Housing": float, "Groceries": float, "Health": float, "Education": float, "Personal Care": float, "Savings": float, "Travel": float, "Other": float}},
              "insights": ["string"],
              "recommendations": ["string"],
              "confidence_factors": ["string"],
              "spending_patterns": {{"trend": "string", "seasonal_factors": ["string"]}}
            }}
            """
            
            response = self.model.generate_content(prompt)
            response_text = response.text.strip()
            
            if response_text.startswith("```json") and response_text.endswith("```"):
                response_text = response_text[7:-3].strip()

            try:
                ai_data = json.loads(response_text)
                predicted_total = ai_data.get('predicted_total', 0.0)
                message = f"Based on your spending patterns, predicted next month expenses: ₹{predicted_total:.2f}"
                return AIInsight(type="prediction", message=message, confidence=0.9, data=ai_data)
            except json.JSONDecodeError as e:
                logger.warning(f"AI prediction response was not valid JSON: {e}")
                return AIInsight(type="prediction", message="AI prediction parsing failed.", confidence=0.5)
        except Exception as e:
            logger.error(f"AI prediction error: {e}")
            return AIInsight(type="prediction", message="Unable to generate prediction at this time.", confidence=0.0, data={"error": str(e)})

    def categorize_expense(self, expense_name: str, amount: float) -> str:
        """Suggest expense category using AI"""
        if not self.model:
            logger.warning("AI model not available for categorization.")
            return "Other"
        
        try:
            valid_categories = ["Food", "Transportation", "Bills", "Entertainment", "Housing", "Groceries", "Health", "Education", "Personal Care", "Savings", "Travel", "Other"]
            prompt = f"""
            You are an AI assistant specialized in categorizing personal expenses. 
            
            Expense Details:
            - Item: "{expense_name}"
            - Amount: ₹{amount:.2f}
            
            Available Categories: {", ".join(valid_categories)}
            
            Respond with ONLY the category name that best fits this expense.
            """
            
            response = self.model.generate_content(prompt)
            category = response.text.strip()
            return category if category in valid_categories else "Other"
        except Exception as e:
            logger.error(f"AI categorization error for '{expense_name}': {e}")
            return "Other"

    def get_spending_insights(self, expenses: List[Expense]) -> List[AIInsight]:
        """Get AI-powered spending insights"""
        if not self.model or not expenses:
            logger.warning("AI model not available or no expenses provided for insights.")
            return []
        
        try:
            # Calculate summary data
            total_expenses = sum(exp.amount for exp in expenses)
            category_breakdown = {}
            for exp in expenses:
                category_breakdown[exp.category] = category_breakdown.get(exp.category, 0) + exp.amount
            
            monthly_expenses = {}
            for exp in expenses:
                month = exp.date[:7]  # YYYY-MM format
                monthly_expenses[month] = monthly_expenses.get(month, 0) + exp.amount
            
            summary_data = {
                "total_expenses": total_expenses,
                "category_breakdown": category_breakdown,
                "monthly_expenses": monthly_expenses,
                "expense_count": len(expenses)
            }
            
            prompt = f"""
            You are a helpful financial assistant. Analyze the expense data and provide actionable insights.
            
            Expense Summary:
            {json.dumps(summary_data, indent=2)}
            
            Provide insights as a JSON array with this format:
            [
              {{"message": "insight text", "data": {{"category": "relevant_category", "amount": float_value}}}},
              {{"message": "another insight", "data": {{"trend": "trend_info"}}}}
            ]
            
            Focus on spending patterns, unusual expenses, budget recommendations, and savings opportunities.
            """
            
            response = self.model.generate_content(prompt)
            response_text = response.text.strip()
            
            if response_text.startswith("```json") and response_text.endswith("```"):
                response_text = response_text[7:-3].strip()

            ai_insights = []
            try:
                ai_raw_insights = json.loads(response_text)
                if isinstance(ai_raw_insights, list):
                    for item in ai_raw_insights:
                        if isinstance(item, dict) and "message" in item:
                            clean_message = item["message"].replace("$", "₹")
                            ai_insights.append(AIInsight(
                                type="insight",
                                message=clean_message,
                                confidence=0.8,
                                data=item.get("data", {})
                            ))
                return ai_insights
            except json.JSONDecodeError as e:
                logger.warning(f"AI insights response was not valid JSON: {e}")
                return [AIInsight(type="insight", message="Unable to process detailed insights at this time.", confidence=0.3)]
        except Exception as e:
            logger.error(f"AI insights generation error: {e}")
            return [AIInsight(type="insight", message="Unable to generate insights due to an unexpected error.", confidence=0.0)]

    def get_financial_health_score(self, expenses: List[Expense], budgets: List[Budget]) -> AIInsight:
        """Calculate financial health score using AI"""
        if not self.model:
            return AIInsight(type="health_score", message="AI service not available.", confidence=0.0)
        
        try:
            # Calculate metrics
            current_month = datetime.now().strftime('%Y-%m')
            monthly_expenses = sum(exp.amount for exp in expenses if exp.date.startswith(current_month))
            total_budget = sum(budget.amount for budget in budgets)
            
            category_spending = {}
            for exp in expenses:
                if exp.date.startswith(current_month):
                    category_spending[exp.category] = category_spending.get(exp.category, 0) + exp.amount
            
            metrics = {
                "monthly_expenses": monthly_expenses,
                "total_budget": total_budget,
                "budget_utilization": (monthly_expenses / total_budget * 100) if total_budget > 0 else 0,
                "category_spending": category_spending,
                "expense_count": len([exp for exp in expenses if exp.date.startswith(current_month)])
            }
            
            prompt = f"""
            Analyze the financial health based on these metrics and provide a score from 0-100:
            
            {json.dumps(metrics, indent=2)}
            
            Respond in JSON format:
            {{
              "health_score": float,
              "grade": "string",
              "factors": ["string"],
              "recommendations": ["string"]
            }}
            """
            
            response = self.model.generate_content(prompt)
            response_text = response.text.strip()
            
            if response_text.startswith("```json") and response_text.endswith("```"):
                response_text = response_text[7:-3].strip()
            
            try:
                health_data = json.loads(response_text)
                score = health_data.get('health_score', 50)
                grade = health_data.get('grade', 'B')
                message = f"Financial Health Score: {score}/100 (Grade: {grade})"
                return AIInsight(type="health_score", message=message, confidence=0.9, data=health_data)
            except json.JSONDecodeError:
                return AIInsight(type="health_score", message="Unable to calculate health score.", confidence=0.3)
        except Exception as e:
            logger.error(f"Health score calculation error: {e}")
            return AIInsight(type="health_score", message="Unable to calculate health score.", confidence=0.0)

# Initialize AI service
ai_service = AIExpenseService()

# API Routes
@app.route('/api/', methods=['GET'])
def root():
    return jsonify({"message": "Smart Expense Tracker API is running!"})

@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    try:
        return jsonify([exp.model_dump() for exp in expenses_db])
    except Exception as e:
        logger.error(f"Error getting expenses: {e}")
        return jsonify({"error": "Failed to get expenses"}), 500

@app.route('/api/expenses', methods=['POST'])
def add_expense():
    try:
        data = request.json
        expense = Expense(**data)
        expenses_db.append(expense)
        return jsonify(expense.model_dump()), 201
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error adding expense: {e}")
        return jsonify({"error": "Failed to add expense"}), 500

@app.route('/api/expenses/<expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    try:
        global expenses_db
        expenses_db = [exp for exp in expenses_db if exp.id != expense_id]
        return jsonify({"message": "Expense deleted successfully"})
    except Exception as e:
        logger.error(f"Error deleting expense: {e}")
        return jsonify({"error": "Failed to delete expense"}), 500

@app.route('/api/budgets', methods=['GET'])
def get_budgets():
    try:
        return jsonify([budget.model_dump() for budget in budgets_db])
    except Exception as e:
        logger.error(f"Error getting budgets: {e}")
        return jsonify({"error": "Failed to get budgets"}), 500

@app.route('/api/budgets', methods=['POST'])
def add_budget():
    try:
        data = request.json
        budget = Budget(**data)
        budgets_db.append(budget)
        return jsonify(budget.model_dump()), 201
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error adding budget: {e}")
        return jsonify({"error": "Failed to add budget"}), 500

@app.route('/api/expenses/predict', methods=['POST'])
def predict_expenses():
    try:
        data = request.json
        expenses = [Expense(**exp) for exp in data.get('expenses', [])]
        
        # Run AI prediction in thread pool
        future = executor.submit(ai_service.predict_next_month_expenses, expenses)
        result = future.result(timeout=30)
        
        return jsonify(result.model_dump())
    except Exception as e:
        logger.error(f"Error predicting expenses: {e}")
        return jsonify({"error": "Failed to predict expenses"}), 500

@app.route('/api/expenses/categorize', methods=['GET'])
def categorize_expense():
    try:
        expense_name = request.args.get('expense_name', '')
        amount = float(request.args.get('amount', 0))
        
        if not expense_name or amount <= 0:
            return jsonify({"error": "Invalid expense name or amount"}), 400
        
        # Run AI categorization in thread pool
        future = executor.submit(ai_service.categorize_expense, expense_name, amount)
        category = future.result(timeout=10)
        
        return jsonify({"suggested_category": category})
    except Exception as e:
        logger.error(f"Error categorizing expense: {e}")
        return jsonify({"error": "Failed to categorize expense"}), 500

@app.route('/api/expenses/insights', methods=['POST'])
def get_spending_insights():
    try:
        data = request.json
        expenses = [Expense(**exp) for exp in data.get('expenses', [])]
        
        # Run AI insights in thread pool
        future = executor.submit(ai_service.get_spending_insights, expenses)
        insights = future.result(timeout=30)
        
        return jsonify([insight.model_dump() for insight in insights])
    except Exception as e:
        logger.error(f"Error getting insights: {e}")
        return jsonify({"error": "Failed to get insights"}), 500

@app.route('/api/expenses/analytics', methods=['POST'])
def get_expense_analytics():
    try:
        data = request.json
        expenses = [Expense(**exp) for exp in data.get('expenses', [])]
        
        if not expenses:
            return jsonify({
                "total_expenses": 0.0,
                "category_breakdown": {},
                "monthly_trend": [],
                "average_daily_spend": 0.0,
                "highest_spending_category": "",
                "spending_growth": 0.0
            })
        
        # Calculate analytics
        total_expenses = sum(exp.amount for exp in expenses)
        category_breakdown = {}
        for exp in expenses:
            category_breakdown[exp.category] = category_breakdown.get(exp.category, 0.0) + exp.amount
        
        # Monthly trend
        monthly_trend = []
        today = datetime.now()
        for i in range(6):
            target_year, target_month = today.year, today.month - i
            while target_month <= 0:
                target_month += 12
                target_year -= 1
            month_str = datetime(target_year, target_month, 1).strftime('%Y-%m')
            month_expenses = [exp for exp in expenses if exp.date.startswith(month_str)]
            monthly_trend.append({
                "month": month_str,
                "total": sum(exp.amount for exp in month_expenses),
                "count": len(month_expenses)
            })
        
        monthly_trend.sort(key=lambda x: x['month'])
        
        # Additional analytics
        average_daily_spend = total_expenses / max(len(set(exp.date for exp in expenses)), 1)
        highest_spending_category = max(category_breakdown.items(), key=lambda x: x[1])[0] if category_breakdown else ""
        
        # Calculate spending growth
        spending_growth = 0.0
        if len(monthly_trend) >= 2:
            current_month = monthly_trend[-1]['total']
            previous_month = monthly_trend[-2]['total']
            if previous_month > 0:
                spending_growth = ((current_month - previous_month) / previous_month) * 100
        
        analytics = ExpenseAnalytics(
            total_expenses=total_expenses,
            category_breakdown=category_breakdown,
            monthly_trend=monthly_trend,
            average_daily_spend=average_daily_spend,
            highest_spending_category=highest_spending_category,
            spending_growth=spending_growth
        )
        
        return jsonify(analytics.model_dump())
    except Exception as e:
        logger.error(f"Error getting analytics: {e}")
        return jsonify({"error": "Failed to get analytics"}), 500

@app.route('/api/budget/alerts', methods=['POST'])
def get_budget_alerts():
    try:
        data = request.json
        expenses = [Expense(**exp) for exp in data.get('expenses', [])]
        budgets = [Budget(**budget) for budget in data.get('budgets', [])]
        
        alerts = []
        current_month_str = datetime.now().strftime('%Y-%m')
        days_in_month = 30  # Simplified
        days_passed = datetime.now().day
        days_remaining = days_in_month - days_passed
        
        for budget in budgets:
            spent = sum(exp.amount for exp in expenses 
                       if exp.category == budget.category and exp.date.startswith(current_month_str))
            percentage = (spent / budget.amount) * 100 if budget.amount > 0 else 0.0
            
            if percentage >= 75:
                alert_type = "warning"
                if percentage >= 90:
                    alert_type = "danger"
                
                alert = BudgetAlert(
                    category=budget.category,
                    budget_amount=budget.amount,
                    spent_amount=spent,
                    percentage_used=percentage,
                    alert_type=alert_type,
                    days_remaining=days_remaining
                )
                alerts.append(alert)
        
        return jsonify([alert.model_dump() for alert in alerts])
    except Exception as e:
        logger.error(f"Error getting budget alerts: {e}")
        return jsonify({"error": "Failed to get budget alerts"}), 500

@app.route('/api/financial-health', methods=['POST'])
def get_financial_health():
    try:
        data = request.json
        expenses = [Expense(**exp) for exp in data.get('expenses', [])]
        budgets = [Budget(**budget) for budget in data.get('budgets', [])]
        
        # Run AI health score calculation in thread pool
        future = executor.submit(ai_service.get_financial_health_score, expenses, budgets)
        health_score = future.result(timeout=30)
        
        return jsonify(health_score.model_dump())
    except Exception as e:
        logger.error(f"Error calculating financial health: {e}")
        return jsonify({"error": "Failed to calculate financial health"}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "ai_service_status": "available" if ai_service.model else "unavailable",
        "timestamp": datetime.now().isoformat()
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8001, debug=True)