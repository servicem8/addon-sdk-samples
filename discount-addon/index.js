'use strict';

const request = require('request');

// Constants
const DISCOUNT_ITEM_CODE = 'Discount';
const API_BASE_URL = 'https://api.servicem8.com/api_1.0';
const EVENTS = {
    APPLY_DISCOUNT: 'apply_discount',
    CALCULATE_DISCOUNT: 'calculate_discount',
    APPLY_DISCOUNT_MATERIAL: 'apply_discount_material'
};

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

// Helper function to handle API errors consistently
function handleApiError(error, callback, context = '') {
    console.error(`API Error ${context}:`, error);
    callback(error);
}

exports.handler = (event, context, callback) => {
    // Handle events based on type
    switch (event.eventName) {
    case EVENTS.APPLY_DISCOUNT:
        return showDiscountUI(event, callback);
    case EVENTS.CALCULATE_DISCOUNT:
        return calculateDiscount(event, callback);
    case EVENTS.APPLY_DISCOUNT_MATERIAL:
        return applyDiscountMaterial(event, callback);
    default:
        return handleApiError(
            new Error(`Unsupported event: ${event.eventName}`),
            callback,
            'Event Handler'
        );
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
            
            // UI Helper Functions
            function getSelectedDiscountType() {
                return document.querySelector('input[name="discountType"]:checked').value;
            }
            
            function getRawDiscountValue() {
                return document.getElementById('discountValue').value;
            }
            
            function formatCurrencyAmount(currencyAmount) {
                const value = parseFloat(currencyAmount);
                return isNaN(value) ? '$0.00' : '$' + value.toFixed(2);
            }
            
            function validateDiscountInput(value) {
                const numericValue = parseFloat(value);
                return !isNaN(numericValue) && numericValue > 0;
            }
            
            function showError(show = true) {
                document.getElementById('error').style.display = show ? 'block' : 'none';
            }
            
            function applyDiscount() {
                const discountType = getSelectedDiscountType();
                const discountValue = getRawDiscountValue();
                
                if (!validateDiscountInput(discountValue)) {
                    showError(true);
                    return;
                }
                
                showError(false);
                
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

function calculateDiscount(event, callback) {
    const { jobUUID, discountType } = event.eventArgs;
    const discountValue = parseFloat(event.eventArgs.discountValue) || 0;

    getJobMaterials(jobUUID, event.auth.accessToken)
        .then(materials => {
            const currentTotal = calculateTotalExcludingDiscounts(materials);
            const discountAmount = calculateDiscountAmount(currentTotal, discountType, discountValue);
            const finalTotal = currentTotal - discountAmount;

            callback(null, {
                eventResponse: JSON.stringify({
                    currentTotal,
                    discountAmount,
                    finalTotal
                })
            });
        })
        .catch(error => callback(error));
}

function applyDiscountMaterial(event, callback) {
    const { jobUUID, discountType } = event.eventArgs;
    const discountValue = parseFloat(event.eventArgs.discountValue);

    if (!discountValue || isNaN(discountValue)) {
        return callback(new Error('Invalid discount value'));
    }

    getJobMaterials(jobUUID, event.auth.accessToken)
        .then(materials => {
            const currentTotal = calculateTotalExcludingDiscounts(materials);

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
                    item_code: DISCOUNT_ITEM_CODE,  // Using constant for consistency
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
