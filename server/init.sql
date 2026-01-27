-- Database Schema for Balanced Scorecard System

-- Drop existing tables if any
DROP TABLE IF EXISTS kpis;
DROP TABLE IF EXISTS goals;
DROP TABLE IF EXISTS perspectives;
DROP TABLE IF EXISTS departments;

-- Departments Table
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    icon_name VARCHAR(50) DEFAULT 'Building'
);

-- Perspectives Table
CREATE TABLE perspectives (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
    UNIQUE(name, department_id)
);

-- Goals Table
CREATE TABLE goals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    perspective_id INTEGER REFERENCES perspectives(id) ON DELETE CASCADE,
    weight DECIMAL(5,2) DEFAULT 0,
    UNIQUE(name, perspective_id)
);

-- KPIs Table
CREATE TABLE kpis (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
    target_value DECIMAL(15,2) DEFAULT 0,
    actual_value DECIMAL(15,2) DEFAULT 0,
    unit VARCHAR(50),
    period VARCHAR(50),
    weight DECIMAL(5,2) DEFAULT 0,
    direction VARCHAR(10) DEFAULT 'up', -- 'up' or 'down'
    UNIQUE(name, goal_id)
);
