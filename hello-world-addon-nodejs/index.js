'use strict';

exports.handler = async (event) => {
    
    console.log('Received event:', JSON.stringify(event, null, 2));

    var strJobUUID = event.eventArgs.jobUUID;

    var strHTMLResponse = `
<html>
	<head>
		<link rel="stylesheet" href="https://platform.servicem8.com/sdk/1.0/sdk.css">
    	<script src="https://platform.servicem8.com/sdk/1.0/sdk.js"></script>
		<script>
			var client = SMClient.init();
			
			//Resize Addon Window
			client.resizeWindow(500, 200);
			
		</script>
    </head>
    <body>
		<h1>Hello World Lambda Event</h1>
		
		<p>You have opened job <b>` + strJobUUID + `</b></p>
		
		<button onClick="client.closeWindow();">Close Window</button>
	</body>
</html>`;
    
	//Return Response
    return {
		eventResponse: strHTMLResponse
	};
    
};
