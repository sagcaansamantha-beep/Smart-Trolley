-- ===========================================================================
-- Migration: 001_create_users_ledger_academic_tables.sql
-- Description: Execute schema migrations for Users, Ledger, and Academic tables
-- ===========================================================================

-- 1. Users / Staff Table
CREATE TABLE IF NOT EXISTS users (
    id            VARCHAR(50) PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    role          VARCHAR(20) NOT NULL CHECK (role IN ('cashier', 'admin', 'staff')),
    initials      VARCHAR(10) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_login   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Ledger / Transaction Audit Table
CREATE TABLE IF NOT EXISTS ledger (
    id             VARCHAR(50) PRIMARY KEY,
    cart_id        VARCHAR(50) NOT NULL,
    cashier_id     VARCHAR(50) NOT NULL,
    total_amount   NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    payment_method VARCHAR(20) NOT NULL,
    verified_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status         VARCHAR(20) NOT NULL DEFAULT 'completed'
);

-- 3. Academic Records Table
CREATE TABLE IF NOT EXISTS academic_records (
    id          VARCHAR(50) PRIMARY KEY,
    term        VARCHAR(50) NOT NULL,
    department  VARCHAR(100) NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
