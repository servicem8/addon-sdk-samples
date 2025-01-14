'use strict';

const request = require('request');

// Constants
const API_BASE_URL = 'https://api.servicem8.com/api_1.0';

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

exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    // Handle the apply_discount event
    if (event.eventName === 'apply_discount') {
        showDiscountUI(event, callback);
    } else if (event.eventName === 'calculate_discount') {
        calculateDiscount(event, callback);
    } else if (event.eventName === 'apply_discount_material') {
        applyDiscountMaterial(event, callback);
    } else {
        callback(new Error(`Unsupported event: ${event.eventName}`));
    }
};

function showDiscountUI(event, callback) {
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
                client.invoke('calculate_discount', {
                    jobUUID: '${event.eventArgs.jobUUID}',
                    discountType: getDiscountType(),
                    discountValue: getDiscountValue()
                }).then(function(response) {
                    const data = JSON.parse(response);
                    document.getElementById('currentTotal').textContent = formatCurrency(data.currentTotal);
                    document.getElementById('discountAmount').textContent = formatCurrency(data.discountAmount);
                    document.getElementById('finalTotal').textContent = formatCurrency(data.finalTotal);
                });
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
                
                if (!discountValue || isNaN(discountValue) || parseFloat(discountValue) <= 0) {
                    document.getElementById('error').style.display = 'block';
                    return;
                }
                
                document.getElementById('error').style.display = 'none';
                
                client.invoke('apply_discount_material', {
                    jobUUID: '${event.eventArgs.jobUUID}',
                    discountType: discountType,
                    discountValue: discountValue
                }).then(function(response) {
                    client.closeWindow();
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

    callback(null, {
        eventResponse: strHTMLResponse
    });
}

function calculateDiscount(event, callback) {
    const jobUUID = event.eventArgs.jobUUID;
    const discountType = event.eventArgs.discountType;
    const discountValue = parseFloat(event.eventArgs.discountValue) || 0;

    // Get current job materials to calculate total
    const options = {
        method: 'GET',
        url: `${API_BASE_URL}/jobmaterial.json?$filter=job_uuid eq '${jobUUID}'`,
        auth: {
            bearer: event.auth.accessToken
        }
    };

    request(options, function(error, response, body) {
        if (error) {
            return callback(error);
        }

        const materials = JSON.parse(body);
        let currentTotal = 0;

        // Calculate current total excluding any existing discounts
        materials.forEach(material => {
            if (material.item_code !== 'Discount') {
                currentTotal += parseFloat(material.quantity) * parseFloat(material.price || 0);
            }
        });

        // Calculate discount amount
        const discountAmount = calculateDiscountAmount(currentTotal, discountType, discountValue);
        const finalTotal = currentTotal - discountAmount;

        callback(null, {
            eventResponse: JSON.stringify({
                currentTotal: currentTotal,
                discountAmount: discountAmount,
                finalTotal: finalTotal
            })
        });
    });
}

function applyDiscountMaterial(event, callback) {
    const jobUUID = event.eventArgs.jobUUID;
    const discountType = event.eventArgs.discountType;
    const discountValue = parseFloat(event.eventArgs.discountValue);

    if (!discountValue || isNaN(discountValue)) {
        return callback(new Error('Invalid discount value'));
    }

    // Get current job materials to calculate total
    const options = {
        method: 'GET',
        url: `${API_BASE_URL}/jobmaterial.json?$filter=job_uuid eq '${jobUUID}'`,
        auth: {
            bearer: event.auth.accessToken
        }
    };

    request(options, function(error, response, body) {
        if (error) {
            return callback(error);
        }

        const materials = JSON.parse(body);
        let currentTotal = 0;

        // Calculate current total excluding any existing discounts
        materials.forEach(material => {
            if (material.item_code !== 'Discount') {
                currentTotal += parseFloat(material.quantity) * parseFloat(material.price || 0);
            }
        });

        // Calculate discount amount and format name
        const discountAmount = calculateDiscountAmount(currentTotal, discountType, discountValue);
        const discountName = formatDiscountName(discountType, discountValue);

        // Create the discount material
        const createOptions = {
            method: 'POST',
            url: `${API_BASE_URL}/jobmaterial.json`,
            auth: {
                bearer: event.auth.accessToken
            },
            json: true,
            body: {
                job_uuid: jobUUID,
                quantity: '-1',
                price: discountAmount.toString(),
                item_code: 'Discount',
                name: discountName
            }
        };

        request(createOptions, function(error) {
            if (error) {
                return callback(error);
            }

            callback(null, {
                eventResponse: JSON.stringify({
                    success: true
                })
            });
        });
    });
}
