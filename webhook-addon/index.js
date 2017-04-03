'use strict';
var request = require('request');

/**
 * ServiceM8 SDK Example: Attachment Add-on
 *
 * This example add-on attaches an image of the ServiceM8 Logo to the Job whenever the Job status changes.
 *
 * The following SDK and API features are demonstrated:
 *  - Authenticating with temporary OAuth tokens
 *  - Reading records from the REST API
 *  - Using the $filter parameter to query API records
 *  - Creating records via the REST API
 *  - Uploading file attachments
 *
 * Note that if you have hosting infrastructure already set up and you are able to implement OAuth authentication, you
 * can use the REST API and the Webhooks API to implement the functionality of this Example Add-on without using Lamdba
 * functions. The power of the SDK and Simple Function Add-ons is that you can now accomplish the same thing without
 * needing to manage any infrastructure or worry about implementing OAuth.
 *
 */
exports.handler = (event, context, callback) => {

    /**
     * An add-on may register multiple webhooks and actions in its manifest file, but it has only a single Lambda
     * function to handle all of those events. The way to determine why your Lambda function was invoked is to check
     * the `eventName` property of the `event` argument.
     *
     * Although it's not strictly required in this Example add-on (because only a single event is registered in the
     * manifest.json) we still perform the check to demonstrate good practices.
     *
     */
    if (event.eventName != 'webhook_subscription') {
        /**
         * Lambda functions are ended by calling the `callback` function provided as an argument. The second parameter
         * is the "result" of the function. We leave it empty here because no actions were taken.
         */
        callback(null, {});
    }

    /**
     * Webhook events can inspect the `eventArgs.entry` argument to get details of the change that caused the webhook
     * to fire.
     */
    var strJobUUID = event.eventArgs.entry[0].uuid;
    var strAccessToken = event.auth.accessToken;

    /**
     * Check if we've already attached the logo to this Job
     *
     * To do this, we query the API for all Attachment records where related_object_uuid matches the UUID of the job
     * that triggered this webhook. Then we loop over the returned results and check if any have an attachment_name of
     * "ServiceM8 Logo".
     *
     * This also demonstrates how to use the Temporary OAuth token that is issued for this event. As described in the
     * OAuth 2.0 spec, access tokens should be provided in the HTTP "Authorization" header with the prefix "Bearer ".
     */
    request.get({
        url: 'https://api.servicem8.com/api_1.0/Attachment.json?' + encodeURIComponent('$filter') + '=' + encodeURIComponent('related_object_uuid eq \'' + strJobUUID + '\''),
        headers: {
            // Use the temporary Access Token that was issued for this event
            'Authorization': 'Bearer ' + strAccessToken
        }
    },function(err, httpResponse, body) {

        /**
         * The API will always return a HTTP 200 on success. If this isn't found, something went wrong during the query
         * and we need to end our Lambda function here.
         */
        if (httpResponse.statusCode != 200) {
            // Unable to query attachment records
            callback(null, {error: "Unable to query attachment records for this job, received HTTP " + httpResponse.statusCode + "\n\n" + body});
            return;
        }

        /**
         * Loop over the returned results and check if any had attachment_name == "ServiceM8 Logo".
         */
        var arrRecords = JSON.parse(body);
        var boolFound = false;
        for (var thisRecord of arrRecords) {
            if (thisRecord.attachment_name == 'ServiceM8 Logo') {
                boolFound = true;
                break;
            }
        }

        if (boolFound) {
            // Attachment record already exists
            callback(null, {error: "Attachment already exists for this job"});
            return;
        }

        /**
         * If we get to here, there were no attachments on the job which matched our filter, so we need to create a new
         * one.
         *
         * Attachments are added in two stages: first we create the attachment record which specifies the name, filetype
         * and the record which it is attached to. Then we can upload the file data for that attachment.
         */
        request.post({
            url: 'https://api.servicem8.com/api_1.0/Attachment.json',
            headers: {
                // Use the temporary Access Token that was issued for this event
                'Authorization': 'Bearer ' + strAccessToken
            },
            form: {
                related_object: 'job',
                related_object_uuid: strJobUUID,
                attachment_name: 'ServiceM8 Logo',
                file_type: '.png'
            }
        }, function(err, httpResponse, body) {

            if (httpResponse.statusCode != 200) {
                // Attachment record failed to create
                callback(null, {error: "Unable to create attachment record, received HTTP " + httpResponse.statusCode + "\n\n" + body});
                return;
            }

            /**
             * When new records are created on the REST API, the UUID is returned in the "x-record-uuid" HTTP header. We
             * inspect this header to get the record's UUID, as we need to know it in order to upload the file data.
             */
            var strAttachmentUUID = httpResponse.headers['x-record-uuid'];
            if (!strAttachmentUUID) {
                // Unable to determine record UUID
                callback(null, {error: "Unable to create attachment record, no x-record-uuid received in header"});
                return;
            }

            /**
             * Now we need to get the file data that we are going to attach. In this example we just fetch the ServiceM8
             * logo from a static URL. In a real add-on, you would likely be fetching your file data from some other API
             * or web service, or reading it from a storage service like Amazon S3.
             *
             */
            request.get({
                url: 'https://www.servicem8.com/images/servicem8_logo.png',
                encoding: null // We need to specify null encoding so that the Request library interprets the response as binary (otherwise it would be interpreted as UTF-8 encoded text)
            }, function(err, httpResponse, body) {

                if (httpResponse.statusCode != 200) {
                    // Couldn't download file
                    callback(null, {error: "Unable to download PDF file, received HTTP " + httpResponse.statusCode + "\n\n" + body});
                    return;
                }

                // The file data is contained in the "body" argument of the callback, we just need to post that to the Attachments endpoint
                request.post({
                    url: 'https://api.servicem8.com/api_1.0/Attachment/' + strAttachmentUUID + '.file',
                    headers: {
                        // Use the temporary Access Token that was issued for this event
                        'Authorization': 'Bearer ' + strAccessToken
                    },
                    body: body
                }, function (err, httpResponse, body) {

                    if (httpResponse.statusCode != 200) {
                        // Couldn't download file
                        callback(null, {error: "Unable to post PDF file, received HTTP " + httpResponse.statusCode + "\n\n" + body});
                        return;
                    }

                    // Upload succeeded!
                    callback(null, {result: "Added attachment to job " + strJobUUID});

                })
            });

        });
    });

};
