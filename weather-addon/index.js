'use strict';

/**
 * ServiceM8 SDK Example: Weather Add-on
 *
 * This example add-on adds a button to the Job Card which displays the weather for upcoming scheduled bookings.
 * Free weather data from OpenWeatherMap.org is used to provide the weather forecasts.
 *
 * The following SDK and API features are demonstrated:
 *  - Authenticating with temporary OAuth tokens
 *  - Reading records from the REST API
 *  - Using the $filter parameter to query API records
 *  - Fetching data from an external API
 *  - Rendering HTML and CSS into the ServiceM8 UI
 *
 * IMPORTANT: this example requires you to provide your OpenWeatherMap API key. You can get an API key for free
 * at http://openweathermap.org.
 *
 */

var request = require("request");
var OPENWEATHERMAP_API_KEY = 'your_api_key_goes_here';

exports.handler = (event, context, callback) => {

    /**
     * Verify that we've received the correct event type, and that we're configured with an API key.
     */
    if (event.eventName != 'show_weather_info') {
        callback(null, {});
        return;
    }

    if (!OPENWEATHERMAP_API_KEY || OPENWEATHERMAP_API_KEY == 'your_api_key_goes_here') {
        callback(null, {
            eventResponse: wrapResponse('<p><strong>OPENWEATHERMAP_API_KEY</strong> is not configured.</p>')
        });
        return;
    }

    // This is the job which we're rendering weather for.
    var strJobUUID = event.eventArgs.jobUUID;

    /**
     * First we'll fetch the job details to determine the location of the job and its job number.
     */
    request.get({
        url: 'https://api.servicem8.com/api_1.0/Job/' + strJobUUID + '.json',
        auth: {
            bearer: event.auth.accessToken // Use the temporary Access Token that was issued for this event
        }
    }, (err, httpResponse, body) => {

        /**
         * The API will always return a HTTP 200 on success. If this isn't found, something went wrong during the query
         * and we need to end our Lambda function here.
         */
        if (httpResponse.statusCode != 200) {
            callback(null, {
                eventResponse: wrapResponse('<p>An error occurred while fetching the details for job ' + strJobUUID + '. ' + JSON.stringify(httpResponse) + '</p>')
            });
            return;
        }

        /**
         * We also need to make sure that the geo_is_valid field is set. Otherwise, we can't trust the data in the lat and
         * lng fields.
         */
        var objJob = JSON.parse(body);
        if (!objJob.geo_is_valid) {
            callback(null, {
                eventResponse: wrapResponse('<p>The weather cannot be determined because there is no location information for this job.</p>')
            });
            return;
        }

        var fltLat = objJob.lat,
            fltLng = objJob.lng;

        /**
         * Next we fetch all JobActivity records which match this job UUID using the $filter parameter of the API.
         *
         * The JobActivity endpoint contains both Scheduled Bookings (activity_was_scheduled == 1) and
         * recorded time from staff checking in and out of jobs (activity_was_scheduled == 0). We'll need manually
         * exclude these from the response, as we can only use one $filter parameter in a single request.
         *
         */
        request.get({
            url: 'https://api.servicem8.com/api_1.0/JobActivity.json?'
                + encodeURIComponent('$filter') + '=' + encodeURIComponent('job_uuid eq \'' + strJobUUID + '\''),
            auth: {
                bearer: event.auth.accessToken // Use the temporary Access Token that was issued for this event
            },
            headers: {
                'sm-date-format': 'ISO8601' // Request dates in ISO8601 format so that they include timezone information
            }
        }, (err, httpResponse, body) => {

            /**
             * The API will always return a HTTP 200 on success. If this isn't found, something went wrong during the query
             * and we need to end our Lambda function here.
             */
            if (httpResponse.statusCode != 200) {
                callback(null, {
                    eventResponse: wrapResponse('<p>An error occurred while fetching scheduled bookings for Job ' + strJobUUID + '. ' + JSON.stringify(httpResponse) + '</p>')
                });
                return;
            }

            var arrBookings = JSON.parse(body);

            /**
             * We've got our booking data, now we need to fetch weather data for the job's location. The OpenWeatherMap
             * forecast returns weather predictions at 3-hour intervals for the next 5 days.
             *
             * Documentation is available at: https://openweathermap.org/forecast5
             *
             */
            request.get({
                url: 'http://api.openweathermap.org/data/2.5/forecast?lat=' + fltLat + '&lon=' + fltLng + '&mode=json&units=metric&APPID=' + OPENWEATHERMAP_API_KEY
            }, (err, httpResponse, body) => {

                if (httpResponse.statusCode != 200) {
                    callback(null, {
                        eventResponse: wrapResponse('<p>An error occurred while fetching scheduled bookings for Job ' + strJobUUID + '. ' + JSON.stringify(httpResponse) + '</p>')
                    });
                    return;
                }

                /**
                 * Now we have both the weather data and the booking data, we will iterate over the bookings and see
                 * if we can determine the weather at the time of each booking.
                 */
                try {
                    var objWeather = JSON.parse(body);
                    var intNow = Math.floor((new Date()).getTime() / 1000.0);
                    var strResult = '';

                    for (let thisBooking of arrBookings) {
                        // Ignore deleted/cancelled bookings, and recorded check-ins
                        if (thisBooking.active == 0 || thisBooking.activity_was_scheduled == 0) {
                            continue;
                        }

                        // Convert the text string in start_date to a unixtime. Note that unixtime is "number of seconds
                        // since midnight Jan 1 1970 UTC" whereas javascript uses milliseconds, so remember to divide/multiply
                        // by 1000 where needed.
                        let intTimeMillis = Date.parse(thisBooking.start_date),
                            intBookingTime = Math.floor(intTimeMillis / 1000.0);

                        // Check if booking is in the past
                        if (intBookingTime < intNow) {
                            continue;
                        }

                        /**
                         * We need to account for timezone manually in order to write out the date in the *account's* timezone,
                         * as JavaScript date objects don't have a per-object "timezone" property. We determine the
                         * timezone of thisBooking.start_date by inspecting the last 4 characters and converting to
                         * integer minutes, then add that to the local timezone offset where this function is being
                         * executed. For Lambda functions this should be 0 because the environment will be set to UTC
                         * timezone.
                         */
                        let intTZDiff = (new Date()).getTimezoneOffset() + parseInt(thisBooking.start_date.substr(-4, 2)) * 60 + parseInt(thisBooking.start_date.substr(-2));
                        let objBookingTime = new Date();
                        objBookingTime.setTime(intTimeMillis + intTZDiff * 60 * 1000);

                        // This will produce a string in the format "Wednesday, April 5, 7:00 AM" which is much more readable than "2017-04-05T07:00+0930"
                        let strTime = objBookingTime.toLocaleString('en-US', {weekday: 'long', month: 'long', day:'numeric', hour:'2-digit', minute:'2-digit'});
                        strResult += '<h3>' + strTime + '</h3>';

                        // See if we have some weather info for this booking
                        let boolWeatherFound = false;
                        for (let thisWeather of objWeather.list) {
                            if (!thisWeather.weather || thisWeather.weather.length < 1) {
                                continue;
                            }

                            // Produce a snippet of HTML to render a weather icon, the predicted temperature, and a weather summary
                            // Weather icons and example data structures are documented at https://openweathermap.org/weather-conditions
                            if (intBookingTime >= thisWeather.dt && intBookingTime < (thisWeather.dt + 3*3600)) {
                                let strIcon = '<img src="http://openweathermap.org/img/w/' + thisWeather.weather[0].icon + '.png" alt="' + thisWeather.weather[0].description + '" />';
                                strResult += '<p class="weatherinfo">' + strIcon + '<span class="temperature">' + Math.round(thisWeather.main.temp) + '&deg;C</span>'
                                    + thisWeather.weather[0].main + '</p>';
                                boolWeatherFound = true;
                                break;
                            }
                        }

                        if (!boolWeatherFound) {
                            strResult += '<p>No forecast for this scheduled booking yet. Check back later, when the booking is within 5 days.</p>';
                        }

                    }

                    /**
                     * Render either a heading or an error message depending on whether we had data to show.
                     */
                    if (!strResult) {
                        strResult += '<p>No scheduled bookings for this job.</p>';
                    } else {
                        strResult = '<h1>Scheduled Bookings for Job #' + objJob.generated_job_id + '</h1>'
                            + strResult
                            + '<p class="attribution">Weather data from <a href="//openweathermap.org">OpenWeatherMap</a>.</p>';
                    }

                    /**
                     * Finally, return our response to be rendered in the ServiceM8 UI
                     */
                    callback(null, {
                        eventResponse: wrapResponse(strResult)
                    });

                } catch (err) {

                    /**
                     * If any of the above code throws an exception, we return information about that exception.
                     *
                     * It's important to remember this step, because if your code throws an exception which isn't caught,
                     * the "callback" function will never be called and your Lambda function won't produce any output
                     * at all. Instead you will receive a "Process exited before completing request" error which is typically
                     * not very useful when troubleshooting what caused the exception.
                     */
                    callback(null, {
                        eventResponse: err.message + '\n\n' + err.stack
                    });
                }
            });

        });



    });

};

/**
 * Add static HTML and Javascript that will be the same for all responses. This is where we include the base CSS and Javascript
 * as well as our custom styles.
 *
 * @param strResponse
 * @returns {string}
 */
function wrapResponse(strResponse) {
    return `
<html>
	<head>
		<link rel="stylesheet" href="https://platform.servicem8.com/sdk/1.0/sdk.css">
    	<script src="https://platform.servicem8.com/sdk/1.0/sdk.js"></script>
		<script>
			var client = SMClient.init();
		</script>
		<style>
            body {
                padding: 1em;
            }
            h1 {
                font-weight: normal;
                border-bottom: solid 1px #ccc;
                margin-bottom: 1em;
                font-size: 1em;
                padding-bottom: 0.5em;
            }
            span.temperature {
		        margin-left: 0.5em;
		        margin-right: 0.5em;
		    }
		    p.weatherinfo {
                font-size: 1.5em;
                line-height: 50px;
            }
            p.weatherinfo img {
                float: left;
            }
		    p.attribution {
		        margin-top: 3em;
		        font-size: 0.8em;
		        color: #ccc;
		    }
		    h3 {
		        margin-bottom: 0.1em;
		    }
        </style>
    </head>
    <body>
		` + strResponse + `
	</body>
</html>
`;
}