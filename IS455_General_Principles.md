# IS455: Machine Learning Pipeline Principles

## 1. The Core Philosophy: Pipeline Thinking
Machine learning is an end-to-end decision system [2]. Every notebook must demonstrate the full CRISP-DM lifecycle, prioritizing a complete story from business problem to deployed solution [2, 3]. 
**Sprint Priority:** "Problems first, deployment second, quality last." Do not over-optimize models at the expense of a completed, deployed pipeline.

## 2. The Two Paradigms: Choose One Per Pipeline
Do not confuse prediction with explanation; they are distinct modeling goals [3, 4]. For each pipeline, choose ONE paradigm that best solves the specific business problem. Make modeling choices consistent with that goal [3]:

**Paradigm A: Explanatory / Causal Modeling**
*   **Goal:** Understand and quantify relationships between variables, ideally identifying cause-and-effect patterns to inform strategy [5].
*   **Success Metric:** Interpretable coefficients, statistical significance, and defensible estimates [3, 6].
*   **Feature Selection:** Remove features that threaten interpretation (e.g., multicollinearity/VIF issues) [7, 8]. 

**Paradigm B: Predictive Modeling**
*   **Goal:** Accurately predict outcomes for new, unseen data to automate or support decisions [4, 5].
*   **Success Metric:** Out-of-sample generalization/performance [4, 8].
*   **Feature Selection:** Remove features that hurt generalization [7]. Complex features and less interpretable models are acceptable if they improve accuracy [9].
*   **Data:** MUST use proper validation strategies (e.g., train/test splits, cross-validation) [9, 10].

## 3. Required Notebook Structure
Every Jupyter Notebook (.ipynb) MUST contain the following 6 sections in order. Notebooks lacking written analysis will receive significant deductions [11].

1. **Problem Framing:** Clear written explanation of the business problem, who cares, and why it matters [12]. Explicitly state whether the approach is predictive or explanatory and justify the choice [12].
2. **Data Acquisition, Preparation & Exploration:** Visually and statistically explore data [12, 13]. Build a reproducible preparation pipeline, not one-off scripts [13].
3. **Modeling & Feature Selection:** Build models, document choices, and justify feature selection [13]. Include hyperparameter tuning if relevant [13]. Focus on interpretability for explanatory models, and out-of-sample performance for predictive models [10].
4. **Evaluation & Interpretation:** Evaluate using proper metrics and validation (train/test split, cross-validation) [10]. Interpret results in business terms and discuss the real-world consequences of false positives/negatives [1, 10].
5. **Causal and Relationship Analysis (REQUIRED):** Discuss the relationships discovered in the data [1]. 
    *   *For explanatory models:* What causal story do the coefficients tell? Are claims defensible? [1]
    *   *For predictive models:* What does the model reveal about the underlying data structure, even if the goal isn't causal inference? [1, 14] 
    *   Be honest about correlation vs. causation limitations [14].
6. **Deployment Notes:** Briefly describe how the model is deployed and integrated into the web application (e.g., API endpoint, dashboard component) [14].