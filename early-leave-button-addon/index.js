const express = require('express');
const app = express();

// Serve static files with no caching
app.use((req, res, next) => {
    res.header('Cache-Control', 'no-store');
    next();
});
app.use(express.static('public'));
app.use(express.json());

// Main handler for ServiceM8 addon
exports.handler = async (event, context, callback) => {
  // Basic HTML template with modern styling
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Early Leave Button</title>
        <style>
            body {
                font-family: 'Arial', sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background-color: #f0f2f5;
            }
            .container {
                text-align: center;
                padding: 2rem;
                background: white;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            #earlyLeaveBtn {
                padding: 1rem 2rem;
                font-size: 1.2rem;
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                transition: background-color 0.3s;
            }
            #earlyLeaveBtn:hover {
                background-color: #45a049;
            }
            #earlyLeaveBtn:disabled {
                background-color: #cccccc;
                cursor: not-allowed;
            }
            #countdown {
                font-size: 2rem;
                margin: 1rem 0;
                color: #333;
            }
            #result {
                font-size: 1.5rem;
                margin-top: 1rem;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Early Leave Button</h1>
            <p>Try your luck! The earlier you try, the lower your chances...</p>
            <button id="earlyLeaveBtn">Press Your Luck!</button>
            <div id="countdown"></div>
            <div id="result"></div>
        </div>
        <script>
            document.addEventListener('DOMContentLoaded', () => {
                const button = document.getElementById('earlyLeaveBtn');
                const countdownEl = document.getElementById('countdown');
                const resultEl = document.getElementById('result');
                
                // For testing: Allow date simulation
                let simulatedDate = null;
                window.setTestDate = (date) => {
                    simulatedDate = date;
                    console.log('Test date set to:', date.toLocaleString());
                };
                window.clearTestDate = () => {
                    simulatedDate = null;
                    console.log('Test date cleared - using real date');
                };
                
                button.addEventListener('click', async () => {
                    try {
                        // Get current time and check if it's Friday first
                        const now = new Date();
                        const currentDay = now.getDay();
                        console.log('Current day:', currentDay, '(5 is Friday)');
                        
                        // Only allow on Fridays
                        if (currentDay !== 5) {
                        console.log('Not Friday - showing restriction message');
                        resultEl.textContent = "Nice try! This only works on Fridays! 😉";
                        resultEl.style.color = "#FF9800";
                        return;
                    }
                    console.log('It is Friday - proceeding with time check');
                    
                    // Disable button during countdown
                    button.disabled = true;
                    
                    // Start 5-second countdown
                    for (let i = 5; i > 0; i--) {
                        countdownEl.textContent = i;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    
                    // Clear countdown
                    countdownEl.textContent = '';
                    
                    // If it's Friday, proceed with time-based probability
                    const hour = now.getHours();
                    const minute = now.getMinutes();
                    
                    // Calculate probability based on time (increases as day progresses)
                    // Start at 10% at noon, increase to 90% by 5 PM
                    const timeInMinutes = hour * 60 + minute;
                    const startTime = 12 * 60; // noon
                    const endTime = 17 * 60;   // 5 PM
                
                    if (timeInMinutes < startTime) {
                        resultEl.textContent = "Too early! Try again after noon! ⏰";
                        resultEl.style.color = "#FF9800";
                    } else {
                        const probability = Math.min(0.9, 
                            0.1 + (0.8 * (timeInMinutes - startTime) / (endTime - startTime))
                        );
                        
                        // Roll the dice!
                        const success = Math.random() < probability;
                        
                        if (success) {
                            resultEl.textContent = "🎉 CONGRATULATIONS! You can leave early! 🎉";
                            resultEl.style.color = "#4CAF50";
                        } else {
                            resultEl.textContent = "Maybe next time! Keep working! 💪";
                            resultEl.style.color = "#F44336";
                        }
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        resultEl.textContent = "Oops! Something went wrong. Please try again.";
                        resultEl.style.color = "#F44336";
                    } finally {
                        // Re-enable button
                        button.disabled = false;
                    }
                });
            });
        </script>
    </body>
    </html>
  `;

  // Return the HTML response
  callback(null, {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html',
    },
    body: html,
  });
};

// Start the server if running directly (not as Lambda)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.get('/', (req, res) => {
    exports.handler({}, {}, (err, result) => {
      if (err) {
        res.status(500).send(err);
      } else {
        res.send(result.body);
      }
    });
  });
  
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}
