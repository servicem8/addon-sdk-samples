'use strict';

/**
 * ServiceM8 SDK Example: Pool Calculator Add-on
 *
 * This example demonstrates how to implement a simple Pool Calculation tool which recommends how much Acid to add
 * to a pool based on volume, current pH and desired pH. A button is added to the job card which opens a window for
 * the user to enter these parameters. Clicking the Calculate button determines what should be added to the pool
 * and posts a note to the Job Diary with this information.
 *
 * The following SDK and API features are demonstrated:
 *  - Authenticating with temporary OAuth tokens
 *  - Posting Job Notes via the REST API
 *  - Rendering HTML and CSS into the ServiceM8 UI
 *  - Using Javascript in an event response
 *  - Using the Client JS SDK to invoke your Lambda function
 *
 */

var request = require("request");

exports.handler = (event, context, callback) => {

    /**
     * In this example, our handler function doesn't do any work itself, but instead just inspects the event name
     * and calls the correct handler to produce the desired output.
     *
     * The "pool_calc_start" event is fired when the user clicks the "Pool Calc" button that we added to the Job
     * Card via the add-on Manifest file.
     *
     * The "pool_calc_calculate" event is fired when the user clicks the "Calculate" button inside the UI that we
     * have rendered. Note that the "pool_calc_calculate" event doesn't appear anywhere in the Manifest -- we only
     * invoke this via the Client JS SDK: client.invoke("pool_calc_calculate", params)
     *
     */
    switch(event.eventName) {
        case 'pool_calc_start':
            handlePoolCalcStart(event, callback);
            break;
        case 'pool_calc_calculate':
            handlePoolCalcCalculate(event, callback);
            break;
        default:
            // Unknown event name
            callback(null, {});
    }

};

/**
 * Produce the HTML and Javascript which renders the interface for the Pool Calculator
 *
 * @param event
 * @param callback
 */
function handlePoolCalcStart (event, callback) {
    // We need to know the Job UUID in order to post a Note to the job
    var strJobUUID = event.eventArgs.jobUUID;

    /**
     * This HTML will be rendered into the popup window in an Iframe. It's divided into two parts:
     * - The "output" div is hidden by default. It contains a placeholder where we will render the results from the
     *   calculation, and a "Done" button that we'll use to close the window.
     * - The "input" div contains input elements that allow the user to enter the required data. We also include a
     *   hidden input to record the Job UUID as we'll need to provide it when we invoke the "pool_calc_calculate" event
     */
    var strHTML = ''
        + '<div id="output" style="display:none;">'
        + '<div id="result"></div>'
        + '<button id="button_done">Done</button>'
        + '</div>'
        + '<div id="input">'
        + '<input type="hidden" id="job_uuid" name="job_uuid" value="' + strJobUUID + '" />'
        + '<label for="pool_volume">Pool volume (litres)</label><input type="text" id="pool_volume_litres" name="pool_volume_litres" value="25000" /><br />'
        + '<label for="current_ph">Current pH</label><input type="text" id="current_ph" name="current_ph" value="7.7" /><br />'
        + '<label for="desired_ph">Desired pH</label><input type="text" id="desired_ph" name="desired_ph" value="7.4"/><br />'
        + '<button id="button_calculate">Calculate</button><br />'
        + '</div>';

    /**
     * This Javascript code is sent to the client and executed by the browser inside the iframe. It is **NOT** executed
     * by the Lambda function.
     *
     * We've included JQuery in this example to simplify the process of manipulating the DOM elements (see the wrapResponse
     * function below)
     */
    var strJS = `
        /**
         * Initialise the client-side SDK as we will need to use it to invoke the pool_calc_calculate event
         */
        var client = SMClient.init();
        
        /*
         * When the DOM is ready, we use JQuery to attach click handlers to the "Calculate" button and 
         * the "Done" button
         */
        $().ready(function() {
        
            /**
             * The "Calculate" button hides the "input" div, shows the "output" div, and uses the Client JS SDK
             * to invoke the "pool_calc_calculate" event. The parameters provided to the event come from the
             * input elements filled with user data. Note that we must include the job_uuid when invoking
             * the event, as it won't be automatically added for events which we invoke using the Client JS SDK.
             * 
             * Once we receive a result from the "pool_calc_calculate" event, it is rendered into the "result"
             * div.
             */
            $("#button_calculate").click(function() { 
                
                $("#input").hide();
                $("#output").show();
                $("#result").html("<p>Calculating...</p>");
                
                client.invoke("pool_calc_calculate", {
                    job_uuid: $("#job_uuid").val(),
                    pool_volume_litres: $("#pool_volume_litres").val(),
                    current_ph: $("#current_ph").val(),
                    desired_ph: $("#desired_ph").val()
                }).then(function(result) {
                    $("#result").html(result);
                });
                
            }); 
            
            /**
             * The "Done" button simply calls the closeWindow() function of the Client JS SDK.
             */
            $("#button_done").click(function() { 
                client.closeWindow(); 
            });
            
        });`;

    /**
     * Once we have our HTML and Javascript, we wrap them in our boilerplate code which includes <html>, <body> tags,
     * javascript and CSS includes etc. You could include that all in the single function, but we've broken it out
     * for clarity.
     */
    callback(null, {eventResponse: wrapResponse(strHTML, strJS)});
}

/**
 * This event is invoked when the user clicks the "Calculate" button inside our Pool Calc popup.
 *
 *
 *
 * @param event
 * @param callback
 */
function handlePoolCalcCalculate(event, callback) {

    /**
     * Event arguments specified in the second argument of client.invoke() are available in the
     * event.eventArgs object.
     */
    var fltCurrentPH = parseFloat(event.eventArgs.current_ph),
        fltDesiredPH = parseFloat(event.eventArgs.desired_ph),
        fltPoolVolumeLitres = parseFloat(event.eventArgs.pool_volume_litres),
        strJobUUID = event.eventArgs.job_uuid;

    var fltDiff = fltCurrentPH - fltDesiredPH,
        strOutput = '',
        strRecommend = '';

    // First, verify that all the required values are present
    if (isNaN(fltCurrentPH) || isNaN(fltDesiredPH) || isNaN(fltPoolVolumeLitres) || fltPoolVolumeLitres < 1.0 || !strJobUUID || !strJobUUID.length==36) {
        strOutput = 'Invalid input provided.'
    } else if (fltDiff > 0.05) {

        // If the pH is too high, we need to add some Acid to bring it down
        // NOTE - obviously these are placeholder calculations to demonstrate the *concept* of a pool calculator,
        // they aren't going to produce results which you could actually use to maintain a pool ;-)
        let fltAcid = fltDiff * (fltPoolVolumeLitres / 10000.0);
        strRecommend = 'Add ' + Math.round(fltAcid * 10)/10 + ' units of Acid';

    } else if (fltDiff < -0.05) {

        // If the pH is too low, we need to add some Lye to raise it
        // NOTE - obviously these are placeholder calculations to demonstrate the *concept* of a pool calculator,
        // they aren't going to produce results which you could actually use to maintain a pool ;-)
        let fltLye = -1.0 * fltDiff * (fltPoolVolumeLitres / 10000.0);
        strRecommend = 'Add ' + Math.round(fltLye * 10)/10 + ' units of Lye';

    } else {
        // Otherwise, no action is required
        strRecommend = 'Don\'t add any chemicals.';
    }

    /**
     * Now if we have a recommendation (i.e. there weren't any errors), we want to post a note to the Job Diary.
     */
    if (strRecommend) {
        strOutput = strRecommend;

        // Produce a note which summarises the inputs used and the recommendation
        let strNote = "Pool volume = " + fltPoolVolumeLitres + " litres"
            + "\nCurrent pH = " + fltCurrentPH
            + "\nDesired pH = " + fltDesiredPH
            + "\n\nRecommendation = " + strRecommend;

        // Now post a Note to the Notes endpoint
        request.post({
            url: 'https://api.servicem8.com/api_1.0/Note.json',
            auth: {
                bearer: event.auth.accessToken // We can use the temporary access token issued to us for authentication
            },
            form: {
                related_object: 'job',
                related_object_uuid: strJobUUID, // This is why we needed to persist the job_uuid through the Pool Calc form
                note: strNote
            }
        }, (err, httpResponse, body) => {

            // Check whether the request succeeded
            let boolNotePosted = (httpResponse.statusCode == 200),
                strNotePosted = boolNotePosted ? '<p>Note has been posted to the Job Diary</p>' : '<p>Unable to post Note to Job Diary: <pre>' + body + '</pre></p>';

            // Now we can return from the Lambda function by calling the "callback" function
            callback(null, {eventResponse: '<h1>' + strOutput + '</h1>' + strNotePosted});

        });

    } else {

        /**
         * Otherwise, we dont have a recommendation so return immediately.
         */
        callback(null, {eventResponse: '<h1>' + strOutput + '</h1>'});

    }

}

/**
 * Add static HTML and Javascript. This is where we include the base CSS and Javascript
 * as well as our custom styles. We also include JQuery in this example so we can get values
 * from input elements and easily attach click handlers to our buttons.
 *
 * @param strHTML
 * @returns {string}
 */
function wrapResponse(strHTML, strJavascript) {
    return `
<html>
	<head>
		<link rel="stylesheet" href="https://platform.servicem8.com/sdk/1.0/sdk.css">
    	<script src="https://platform.servicem8.com/sdk/1.0/sdk.js"></script>
    	<script src="https://code.jquery.com/jquery-3.2.1.min.js" integrity="sha256-hwg4gsxgFZhOsEEamdOYGBf13FyQuiTwlAQgxVSNgt4=" crossorigin="anonymous"></script>
		<script>
			` + strJavascript + `
		</script>
		<style>
            body {
                padding: 1em;
            }
        </style>
    </head>
    <body>
		` + strHTML + `
	</body>
</html>
`;
}