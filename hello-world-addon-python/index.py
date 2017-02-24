from __future__ import print_function

import os
from datetime import datetime
from urllib2 import urlopen

def lambda_handler(event, context):
    try:
      
        job_uuid = event['eventArgs']['jobUUID'];

        response_html = """<html>
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

                <p>You have opened job <b>{job_uuid}</b></p>

                <button onClick="client.closeWindow();">Close Window</button>
        </body>
        </html>""".format(job_uuid=job_uuid)

        print(response_html)
        return {'eventResponse': response_html}

    except:
        print('Function failed')
        raise
