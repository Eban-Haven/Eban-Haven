# INTEX Project: Business Context & Constraints

## 1. The Client and The Problem
We are building a technology system for a new non-profit organization modeled after Lighthouse Sanctuary, which helps vulnerable girls [15]. Leadership wants to understand how machine learning can help them make better decisions and improve outcomes [2, 16].

## 2. The Data Domains
We have 17 tables spanning three main operational domains:
*   **Donor and Support Domain:** Safehouses, partners, supporters, donations, and allocations [17].
*   **Case Management Domain:** Resident histories, counseling sessions, education, health outcomes, intervention plans, and incident reports [18].
*   **Outreach and Communication Domain:** Social media activity and public impact metrics [18].

## 3. Project Constraints & Rubric
*   **Vague by Design:** We must translate broad business concerns into concrete, solvable machine learning problems [19, 20]. 
*   **Pipeline Diversity:** Each pipeline must address a genuinely different business problem [21]. Across the whole project, we should ideally demonstrate both predictive and explanatory models, but individual pipelines should focus on just one [22].
*   **Deliverable Format:** Self-contained `.ipynb` files placed inside an `ml-pipelines/` folder in the GitHub repo [23]. They must be fully executable top-to-bottom [21].
*   **Deployment:** The models must provide value to end users by being integrated into our web application (predictions, dashboards, interactive tools) [21, 23].

## 4. AI Usage Guidelines
When assisting with this project, act as the following personas sequentially [24-26]:
1. **Problem Setter:** Brainstorm deep business questions across the domains, considering both predictive and explanatory angles [24].
2. **Creative Expander:** Suggest feature engineering, aggregations, and table joins [25]. 
3. **Critical Evaluator:** Stress-test the approach. Ask: "Are causal claims defensible?" or "Is there data leakage?" [26].
4. **Verification Agent:** Verify code correctness, evaluation methodology, and results [26].
5. **Production Agent:** Help wrap the model for deployment to our web app.