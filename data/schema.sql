-- Simple schema for a products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    description TEXT
);

-- Sample data for the products table
INSERT INTO products (name, price, description) VALUES
('Laptop', 1200.00, 'High-performance laptop for all your needs'),
('Mouse', 25.00, 'Ergonomic wireless mouse'),
('Keyboard', 75.00, 'Mechanical keyboard with RGB lighting'),
('Monitor', 300.00, '27-inch 4K UHD monitor'),
('Webcam', 50.00, '1080p HD webcam for video conferencing');
