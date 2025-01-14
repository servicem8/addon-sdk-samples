'use strict';

const express = require('express');
const cors = require('cors');
const request = require('request');

const app = express();
const port = process.env.PORT || 3000;

// Constants from index.js
const DISCOUNT_ITEM_CODE = 'Discount';
const API_BASE_URL = 'https://api.servicem8.com/api_1.0';

// Middleware
app.use(express.json());
app.use(cors({
    origin: ['https://ap-southeast-2.go.servicem8.com', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token is required' });
    }

    // Store token in request for route handlers
    req.accessToken = token;
    next();
}

// Apply authentication middleware to API routes only
app.use(['/calculate-discount', '/apply-discount-material'], authenticateToken);

// Helper function to calculate discount amount
function calculateDiscountAmount(currentTotal, discountType, discountValue) {
    if (discountType === 'percentage') {
        return currentTotal * (discountValue / 100);
    }
    return discountValue;
}

// Helper function to format discount name
function formatDiscountName(discountType, discountValue) {
    if (discountType === 'percentage') {
        return `${discountValue}% Discount`;
    }
    return `$${parseFloat(discountValue).toFixed(2)} Discount`;
}

// Helper function to get job materials
function getJobMaterials(jobUUID, accessToken) {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'GET',
            url: `${API_BASE_URL}/jobmaterial.json?$filter=job_uuid eq '${jobUUID}'`,
            auth: { bearer: accessToken }
        };

        request(options, (error, response, body) => {
            if (error) return reject(error);
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                reject(e);
            }
        });
    });
}

// Helper function to calculate total excluding discounts
function calculateTotalExcludingDiscounts(materials) {
    return materials.reduce((total, material) => {
        if (material.item_code !== DISCOUNT_ITEM_CODE) {
            return total + (parseFloat(material.quantity) * parseFloat(material.price || 0));
        }
        return total;
    }, 0);
}

// Route: Show discount UI
app.get('/discount-ui', (req, res) => {
    const { jobUUID, token } = req.query;

    if (!jobUUID || !token) {
        return res.status(400).json({ error: 'Missing jobUUID or token parameter' });
    }

    const strHTMLResponse = `
<html>
    <head>
        <link rel="stylesheet" href="https://platform.servicem8.com/sdk/1.0/sdk.css">
        <script src="https://platform.servicem8.com/sdk/1.0/sdk.js"></script>
        <style>
            body { padding: 20px; font-family: Arial, sans-serif; }
            .container { max-width: 500px; margin: 0 auto; }
            .form-group { margin-bottom: 15px; }
            .form-group label { display: block; margin-bottom: 5px; }
            .form-group input { width: 100%; padding: 8px; box-sizing: border-box; }
            .radio-group { margin-bottom: 10px; }
            .radio-group label { margin-right: 15px; }
            .totals { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 4px; }
            .btn { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
            .btn:hover { background: #0056b3; }
            #error { color: red; margin-top: 10px; display: none; }
        </style>
        <script>
            var client = SMClient.init();
            
            // Resize window on load
            client.resizeWindow(550, 600);
            
            // Get current job materials and calculate total
            function getCurrentTotal() {
                fetch('/calculate-discount', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ${token}'
                    },
                    body: JSON.stringify({
                        jobUUID: '${jobUUID}',
                        discountType: getDiscountType(),
                        discountValue: getDiscountValue()
                    })
                })
                .then(response => response.json())
                .then(data => {
                    document.getElementById('currentTotal').textContent = formatCurrency(data.currentTotal);
                    document.getElementById('discountAmount').textContent = formatCurrency(data.discountAmount);
                    document.getElementById('finalTotal').textContent = formatCurrency(data.finalTotal);
                })
                .catch(error => console.error('Error:', error));
            }
            
            function getDiscountType() {
                return document.querySelector('input[name="discountType"]:checked').value;
            }
            
            function getDiscountValue() {
                return document.getElementById('discountValue').value;
            }
            
            function formatCurrency(amount) {
                return '$' + parseFloat(amount).toFixed(2);
            }
            
            function applyDiscount() {
                const discountType = getDiscountType();
                const discountValue = getDiscountValue();
                
                if (!discountValue || isNaN(discountValue) || discountValue <= 0) {
                    document.getElementById('error').style.display = 'block';
                    return;
                }
                
                document.getElementById('error').style.display = 'none';
                
                fetch('/apply-discount-material', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ${token}'
                    },
                    body: JSON.stringify({
                        jobUUID: '${jobUUID}',
                        discountType: discountType,
                        discountValue: discountValue
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        client.closeWindow();
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    document.getElementById('error').style.display = 'block';
                });
            }
            
            // Update totals when discount type or value changes
            function onInputChange() {
                getCurrentTotal();
            }
        </script>
    </head>
    <body>
        <div class="container">
            <h1>Apply Discount</h1>
            
            <div class="form-group">
                <div class="radio-group">
                    <label>
                        <input type="radio" name="discountType" value="percentage" checked onchange="onInputChange()">
                        Percentage
                    </label>
                    <label>
                        <input type="radio" name="discountType" value="amount" onchange="onInputChange()">
                        Fixed Amount
                    </label>
                </div>
            </div>
            
            <div class="form-group">
                <label>Discount Value:</label>
                <input type="number" id="discountValue" step="0.01" min="0" oninput="onInputChange()">
            </div>
            
            <div class="totals">
                <p>Current Total: <span id="currentTotal">$0.00</span></p>
                <p>Discount Amount: <span id="discountAmount">$0.00</span></p>
                <p>Final Total: <span id="finalTotal">$0.00</span></p>
            </div>
            
            <button class="btn" onclick="applyDiscount()">Apply Discount</button>
            
            <div id="error">Please enter a valid discount value greater than 0.</div>
        </div>
    </body>
</html>`;

    res.send(strHTMLResponse);
});

// Route: Calculate discount
app.post('/calculate-discount', async (req, res) => {
    const { jobUUID, discountType, discountValue } = req.body;
    const authHeader = req.headers.authorization;
    const accessToken = authHeader && authHeader.split(' ')[1];

    if (!jobUUID || !accessToken) {
        return res.status(400).json({ error: 'Missing jobUUID or authorization' });
    }

    try {
    // For testing purposes, if using test-token, return mock data
        if (req.accessToken === 'test-token') {
            const mockTotal = 100;
            const mockDiscountAmount = calculateDiscountAmount(mockTotal, discountType, discountValue);
            return res.json({
                currentTotal: mockTotal,
                discountAmount: mockDiscountAmount,
                finalTotal: mockTotal - mockDiscountAmount
            });
        }

        const materials = await getJobMaterials(jobUUID, req.accessToken);
        const currentTotal = calculateTotalExcludingDiscounts(materials);
        const discountAmount = calculateDiscountAmount(currentTotal, discountType, discountValue);
        const finalTotal = currentTotal - discountAmount;

        res.json({
            currentTotal,
            discountAmount,
            finalTotal
        });
    } catch (error) {
        console.error('Error calculating discount:', error);
        res.status(500).json({ 
            error: 'Failed to calculate discount',
            details: error.message 
        });
    }
});

// Route: Apply discount material
app.post('/apply-discount-material', async (req, res) => {
    const { jobUUID, discountType, discountValue } = req.body;
    const authHeader = req.headers.authorization;
    const accessToken = authHeader && authHeader.split(' ')[1];

    if (!jobUUID || !accessToken || !discountValue || isNaN(discountValue)) {
        return res.status(400).json({ error: 'Invalid request parameters' });
    }

    try {
    // For testing purposes, if using test-token, return mock success
        if (req.accessToken === 'test-token') {
            return res.json({ success: true });
        }

        const materials = await getJobMaterials(jobUUID, req.accessToken);
        const currentTotal = calculateTotalExcludingDiscounts(materials);
        const discountAmount = calculateDiscountAmount(currentTotal, discountType, discountValue);
        const discountName = formatDiscountName(discountType, discountValue);

        // Create the discount material
        const createOptions = {
            method: 'POST',
            url: `${API_BASE_URL}/jobmaterial.json`,
            auth: { bearer: req.accessToken },
            json: true,
            body: {
                job_uuid: jobUUID,
                quantity: '-1',  // Negative quantity for discount
                price: discountAmount.toString(),  // Convert to string for API consistency
                item_code: DISCOUNT_ITEM_CODE,  // Using constant for consistency
                name: discountName  // Formatted as '10% Discount' or '$5.00 Discount'
            }
        };

        request(createOptions, (error) => {
            if (error) {
                console.error('Error creating discount material:', error);
                return res.status(500).json({ 
                    error: 'Failed to create discount material',
                    details: error.message
                });
            }

            res.json({ success: true });
        });
    } catch (error) {
        console.error('Error applying discount:', error);
        res.status(500).json({ 
            error: 'Failed to apply discount',
            details: error.message
        });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Discount Service listening on port ${port}`);
});
