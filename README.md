Project Summary: HydraLytica Dashboard – Telematics Application for Data Analysis

Objective:
A web-based portal system, the HydraLytica Dashboard, displays telematics data for company XXX Production department. The platform is designed to streamline data access and eliminate the need for direct interaction with the underlying database (MySQL), ensuring a secure, user-friendly interface for retrieving telematics data from the company's database.

Key Features and Functionalities:

User Interface: Created an intuitive and responsive interface that allows users to easily navigate through different sections of the dashboard (Inventory, Device Data, and Dashboard).
Data Tables: Implemented an Inventory Table to display telematics device data, including device IDs, customer names, machine types, efficiency baselines, and communication dates. Users can search, sort, and export data to Excel.
Device Data Table: Developed a detailed Device Data Table with pagination to handle large datasets, allowing users to access specific device data within date ranges and export this data to Excel.
Dashboard Visualization: Integrated a dynamic dashboard to visualize key performance indicators (KPIs) such as fuel lifetime, fuel telematics, odometer, runtime, speed, and GPS data for specific devices, based on user-selected date ranges.
Technical Specifications:

Frontend: Developed using ReactJS & JavaScript within a NodeJS Runtime environment.
Backend: Connected to a MariaDB database, retrieving data from various tables (h2gen.dya_h2gen_unit_info, h2gen.dya_telematics_units, h2gen.dya_organizations, h2gen.dya_telematics_units_data) to populate the dashboard and tables.
Pagination & Filtering: Employed pagination for efficient data retrieval from large tables and added sorting and searching functionalities for easy access to relevant information.
Data Export: Implemented export functionalities to allow users to download the data in Excel format.
Security & Access:

Intranet-based Access: As part of an internal system, the portal leverages the company's VPN, eliminating the need for complex authentication. The system is designed to ensure that users can only access the data but not modify or delete it.
Non-Functional Requirements:

Performance: Ensured the application loads quickly and responds to queries in a timely manner.
Reliability: Achieved a system uptime of 99%, ensuring availability and minimizing downtime.
Usability: Focused on building a user-friendly and intuitive interface to enhance the user experience, particularly for the Production and Service teams with limited technical knowledge.
Compatibility: Ensured the platform works across various operating systems, hardware configurations, and browsers.
Maintainability: Designed the system with ease of maintenance in mind, keeping costs low and simplifying future updates.
Development Methodology:
Utilized Scrum for project management, ensuring iterative development and close collaboration with stakeholders for constant feedback and refinement. Regular meetings ensured proper understanding of user requirements and prioritized tasks.

This project significantly improved the efficiency of the Production team by automating data retrieval, reducing reliance on SQL scripts, and providing an easy-to-use interface for telematics data access.
