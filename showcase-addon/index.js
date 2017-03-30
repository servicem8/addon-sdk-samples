'use strict';

//Include the request module so we're able to easily make API requests (note Request module is included for Simple Functions, but if you need any other modules you'll need to use AWS Lambda instead)
var request = require("request");

/**
 * exports.handler is called for every event, determine which event was called, and route to function for handling
 * 
 * Note: event.eventName is always lower-case.
 */
exports.handler = (event, context, callback) => {
    
	//Route Event based on event name
	if(event.eventName == 'showcase_main_menu') {
		//Showcase_Main_Menu was defined in the manifest.json as the event to run on Job Action Popup
	   showMainMenu(event, callback);
	   
	} else if(event.eventName == 'request_job_data_event') {
		//request_job_data_event is called from the client-side client.invoke() function on the main menu event
		requestJobData(event, callback);
		
	}
	
};
  
/**
 * Job Action Main Menu
 * 
 * Simple functions can render HTML content into a Job/Client Action popup window. This could be simple static HTML, or dynamic by using the event data context about the currently open job card.
 * If you wish to make event requests after the initial event has loaded, make sure to include the ServiceM8 Client SDK in your HTML, so you can use the invoke function to pass data back to your server-side simple function.
 */
function showMainMenu(event, callback) {

    var strHTMLResponse = `
<html>
	<head>
		<link rel="stylesheet" href="https://platform.servicem8.com/sdk/1.0/sdk.css">
    	<script src="https://platform.servicem8.com/sdk/1.0/sdk.js"></script>
		<script>
			var client = SMClient.init();
			
			//Resize Addon Window
			client.resizeWindow(650, 650);
			
			function getJobData(strJobUUID) {
			
			    //Use the ServiceM8 Client SDK 'invoke' method to pass our request to our server-side function
				client.invoke('request_job_data_event', {
					jobUUID: strJobUUID
				}).then(function(message) {
				
					document.getElementById('JobData').innerHTML = '<pre>' + message + '</pre>';
				
				});
			
			}
			
		</script>
		<style>
			
			#EventData {
				display: none;
			}
			
		</style>
    </head>
    <body>
		<h1>Addon Showcase</h1>
		<p>The addon showcase demonstrates the client side capabilities of addons using the Job Action.</p>
			
		<p>You have launched addon showcase from job <b>` + event.eventArgs.jobUUID + `</b></p>
			
		<button onClick="document.getElementById('EventData').style.display = 'block';">Show Event Data</button>
		
		<button onClick="client.closeWindow();">Close Window</button>
			
		<button onClick="client.resizeWindow((Math.random() * 500) + 250, (Math.random() * 500) + 250);">Random Resize Window</button>
			
		<button onClick="getJobData('` + event.eventArgs.jobUUID + `');">Load Job Data</button>
		
		<div id="EventData">
			<pre>` + JSON.stringify(event, null, 2) + `</pre>
		</div>
			
		<div id="JobData"></div>
			
	</body>
</html>
`;
    
	//Return Response
    callback(null, { 
		eventResponse: strHTMLResponse
	});
	
}

/**
 * This event is invoked from the main menu 'Load Job Data' button using the invoked event 'request_job_data_event'.
 * 
 * We're able to request job data from the API because each event is issued with a temporary accessToken (event.auth.accessToken), and know the job UUID because we passed it from the main menu event (event.eventArgs.jobUUID)
 */
function requestJobData(event, callback) {
	
  var options = { 
	  method: 'GET',
      url: 'https://api.servicem8.com/api_1.0/job/' + event.eventArgs.jobUUID + '.json',
      auth: {
        bearer: event.auth.accessToken
      }
  };

  //Make Request to ServiceM8 API
  request(options, function (error, response, body) {
    
	 if (error) {
		//Handle Error
		return callback("Unable to retrieve job [" + event.eventArgs.jobUUID + "] [" + error + "]");
	 }
	
	//Parse Job Data
	 var jobData = JSON.parse(body);
	
	 //Success - Return Job JSON as the Response
     callback(null, { 
		eventResponse: JSON.stringify(jobData, null, 2)
	 });
	
  });
	
}
  