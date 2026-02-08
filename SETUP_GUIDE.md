# Project Setup Guide (Local Deployment)

If you have received this project and need to run it on your laptop for the first time, follow these steps. This guide assumes you have **nothing** installed yet.

## Prerequisites

### 1. Install Node.js
- Download and install the "LTS" version of Node.js from [nodejs.org](https://nodejs.org/).
- This will also install `npm` (Node Package Manager).

### 2. Install PostgreSQL
- Download and install PostgreSQL from [postgresql.org](https://www.postgresql.org/download/).
- During installation, you will be asked to set a password for the `postgres` user. **Keep this password handy.**

---

## Database Configuration

The application expects a specific database setup. Follow these steps:

1. **Open "pgAdmin 4"** (installed with PostgreSQL) or use the `psql` command line.
2. **Create a new database** named `bsc_db`.
3. **Change the Password**: The code currently expects the password for the `postgres` user to be `sondos`. If you set a different password during installation, you will need to update it in `server/index.js` (line 26).
4. **Initialize Tables**:
   - Open the Query Tool in pgAdmin for the `bsc_db` database.
   - Open the file `server/init.sql` from the project folder.
   - Copy the contents and execute them in the Query Tool. This creates the basic `departments`, `perspectives`, `goals`, and `kpis` tables.

---

## Application Setup

Once the database is ready, open your terminal (Command Prompt or PowerShell) and navigate to the project directory:

### 1. Install Dependencies
Run this command to download all required libraries:
```bash
npm install
```

### 2. Start the Backend Server
Run this command to start the database connection and API:
```bash
npm run server
```
*Note: Keep this terminal window open.*

### 3. Start the Frontend Application
Open a **second** terminal window in the same folder and run:
```bash
npm run dev
```
- This will provide a local URL (usually `http://localhost:5173`).
- Open this URL in your browser to view the application.

---

## Troubleshooting
- **Database Connection Error**: If the server fails to start, ensure PostgreSQL is running and the credentials (`user`, `database`, `password`) in `server/index.js` match your local setup.
- **Port Busy**: If port 3002 or 5173 is in use, the application might fail to start. Ensure no other instances are running.
