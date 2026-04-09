## 1. Core Architecture Overview
Our application follows a modern, decoupled web architecture separating the frontend, backend, and database. 
*   **Frontend (UI):** Built with React and TypeScript, bundled using Vite. It is deployed and hosted on **Vercel**.
*   **Backend API (Logic & Security):** Built with ASP.NET Core v10 (C#). It serves as the middleman between the frontend and the database, handling all business logic, authentication, and Role-Based Access Control (RBAC). It is deployed and hosted on **Microsoft Azure**.
*   **Database (Storage):** A PostgreSQL relational database managed by **Azure**. It stores all operational data (Donor, Case Management, Outreach) and user identity credentials. 

## 2. Data Flow
1. A user (e.g., safehouse staff or admin) interacts with the React frontend.
2. The frontend sends secure, HTTPS requests to the ASP.NET Core backend.
3. The backend validates the user's role, queries the Azure PostgreSQL database, and processes the data.
4. The backend sends the formatted response back to the React frontend to be displayed to the user.
*Note: The frontend NEVER communicates directly with the database.*

## 3. Machine Learning Integration Strategy
Our machine learning pipelines are developed in Python using Jupyter Notebooks (`.ipynb`) and must be integrated into this C#/React architecture. 

Because Python and C# run in different environments, our deployment strategy is "Inference via Backend Integration". 
When generating deployment code for a pipeline, follow these integration steps:
*   **The ML Output:** The Python pipeline should process the data and generate predictions, classifications, or explanatory insights.
*   **Backend Integration (C#):** Provide the ASP.NET Core v10 API controller code required to surface these insights. (e.g., If the model predicts "Reintegration Readiness", write the C# endpoint that queries the database and serves that readiness score to the frontend).
*   **Frontend Integration (React/TS):** Provide the React component code (e.g., a dashboard widget or table column) that fetches the data from the C# backend and displays it intuitively for the end user.