$(window).load(function() {
  $('.flexslider').flexslider({
    animation: "slide",
    	slideshow:false
  });
});

// Helper for acceleration difference calculation
var prevAccel = null;
// List containing the acceleration data
var deltaAccelList = [];
// List containing the location data
var locationList = [];


// DEBUG: Accelereation value plot
var accelPlot = null;
// DEBUG: Values for the diagram
var accelDataSeries = [];
// DEBUG: Threshold for new points on the plot
var potHoleTreshold = 1;

var queue = [];
var queueSize = 20; // Größe des Zwischenspeichers (fifo-queue) -> je kleiner, umso schneller die Transitions...
var queueTop = 13; //obere Intervallgrenze - muss geändert werden, falls queueSize geändert wurde
var queueMiddle = 8; // untere Intervallgrenze - muss geändert werden, falls queueSize geändert wurde


/* Domain classes */
function DeltaAccelData(x, y, z, timestamp) {
    var self = this;

    self.x = x;
    self.y = y;
    self.z = z;

    self.timestamp = timestamp;
}

function LocationData(latitude, longitude, timestamp) {
    var self = this;

    self.latitude = latitude;
    self.longitude = longitude;

    self.timestamp = timestamp;
}

/* Cordova Events */
function onLoad() {
    document.addEventListener("deviceready", onDeviceReady, false);
    window.addEventListener("orientationchange", doOnOrientationChange);
}

function doOnOrientationChange() {
    setTimeout(updateAccelChart, 500);
}

function onDeviceReady() {
    initChart();
}

/* Acceleration handlers */
function startAccelWatch() {
    var accelOptions = { frequency: 150 };
    accelWatchID = navigator.accelerometer.watchAcceleration(onAccelSuccess, onAccelError, accelOptions);
    queueSum = 0;
    setError('errorAccel', 'Starting Accelerometer');
}

function stopAccelWatch() {
    if (accelWatchID) {
        setError('errorAccel', 'Stopping Accelerometer');
        navigator.accelerometer.clearWatch(accelWatchID);
        accelWatchID = null;
    }
}

function onAccelSuccess(acceleration) {
    var deltaAccel = calculateDeltaAccel(acceleration);
    if (deltaAccel) {
        absSum = sumOfAbsolute (deltaAccel);
        if (absSum > potHoleTreshold) {
            deltaAccelList.push(deltaAccel);

            // DEBUG: Add absolute sum of axis to diagram
            addToChart(deltaAccel.timestamp, absSum);
        }
    }
    updateSiteAccel(deltaAccel);
}

function onAccelError() {
    setError('errorAccel', 'Error on Accelerometer');
}

function calculateDeltaAccel(acceleration) {
    var deltaAccel = null;

    if(prevAccel != null) {
        var deltaTime = acceleration.timestamp - prevAccel.timestamp;

        if (deltaTime > 0 )
            deltaAccel = new DeltaAccelData(acceleration.x - prevAccel.x, 
                                        acceleration.y - prevAccel.y,
                                        acceleration.z - prevAccel.z,
                                        acceleration.timestamp);
    }

    prevAccel = acceleration;
    return deltaAccel;
}

function updateSiteAccel(acceleration) {
    if (acceleration) {
        var accelElement = document.querySelector('#accelerometer');

        accelElement.querySelector('#accelX').innerHTML = acceleration.x.toFixed(3);
        accelElement.querySelector('#accelY').innerHTML = acceleration.y.toFixed(3);
        accelElement.querySelector('#accelZ').innerHTML = acceleration.z.toFixed(3);
        
        queue.push(acceleration.y);
        
        if(queue.length >= queueSize){
        	var firstElement = queue.shift(); // fifo
        }
        var sum = calculateQueue(queue);
        accelElement.querySelector('#sum').innerHTML = sum.toFixed(3);
        accelElement.querySelector('#queuelength').innerHTML = queue.length;
        if(sum > queueTop){
        	$('.colorContainer').css({"background-color":"red"});
        }else if((sum >= queueMiddle) && (sum <= queueTop)){
        	$('.colorContainer').css({"background-color":"orange"});
    	}else{
        	$('.colorContainer').css({"background-color":"green"});
        }
    }
}

function calculateQueue(queue){
	var sum = 0;
	for(var i = 0; i < queue.length; i++){
		sum+=Math.abs(queue[i]);
	}
	return sum;
}

function showAccelList() {
    var listElement = document.querySelector('#list');
    listElement.innerHTML = "";
    for (var i = deltaAccelList.length - 1; i >= 0; i--)
        listElement.innerHTML += deltaAccelList[i].timestamp + "-  X: " + deltaAccelList[i].x.toFixed(3) + " - Y: " + deltaAccelList[i].y.toFixed(3) + " - Z: " + deltaAccelList[i].z.toFixed(3) + "<br>";
}

/* Location handlers */
function onGeolocationSuccess(position) {
    locationList.push(new LocationData(position.coords.latitude, position.coords.longitude, position.timestamp));
    var locationElement = document.querySelector('#locationData');
    locationElement.querySelector('#latitude').innerHTML = position.coords.latitude;
    locationElement.querySelector('#longitude').innerHTML = position.coords.longitude;
}

function onLocationError() {
    setError('errorLocation', 'Error on Location - Restaring watch');
    stopLocationWatch();
    startLocationWatch();
}

function startLocationWatch() {
    var locationOptions = { maximumAge: 1000, timeout: 30000, enableHighAccuracy: true };
    locationWatchID = navigator.geolocation.watchPosition(onGeolocationSuccess, onLocationError, locationOptions);
}

function stopLocationWatch() {
    if (locationWatchID) {
        navigator.geolocation.clearWatch(locationWatchID);
        locationWatchID = null;
    }
}

function showLocationList() {
    var listElement = document.querySelector('#list');
    listElement.innerHTML = "";
    for (var i = locationList.length - 1; i >= 0; i--)
        listElement.innerHTML += "Lat: " + locationList[i].latitude + " - Long: " + locationList[i].longitude + "<br>";
}

/* Common helpers */
function startWatch() {
    startAccelWatch();
    startLocationWatch();
}

function stopWatch() {
    stopAccelWatch();
    stopLocationWatch();
}

function setError(tagId, message) {
    var errorElement = document.querySelector('#' + tagId);
    errorElement.innerHTML = message;
}

function sumOfAbsolute(accelDataPoint) {
    return Math.abs(accelDataPoint.x) + Math.abs(accelDataPoint.y) + Math.abs(accelDataPoint.z);
}

function resetValues() {
    prevAccel = null;
    queueSum = 0;
    queue = [];
    deltaAccelList = [];
    locationList = [];
    accelDataSeries = [];

    setError('errorAccel', 'Values reset');
    setError('errorLocation', 'Values reset');

}

/* Chart */
function initChart() {
    accelPlot = $.jqplot ('chart', [[0, 0]], {
        title:'Accelerometer Data', 
        series:[{showLine: false}],
        axes: {
            // options for each axis are specified in seperate option objects.
            xaxis: {
              label: "Time [s]",
              min:0,
              pad: 0
            },
            yaxis: {
                pad:0
            }
        }
    });
}

function updateAccelChart() {
    accelPlot.series[0].data = accelDataSeries;
    accelPlot.resetAxesScale();

    accelPlot.replot();
}

function addToChart(timestamp, absSum) {
    accelDataSeries.push([timestamp, absSum]);
    updateAccelChart();
}

function toggleOthers(showthis){
	$('.toggle').hide();
	$(showthis).show();
}

function startEngine(){
	toggleOthers('.colorContainer');
	startWatch();
	//TODO
}

function stopEngine(){
	toggleOthers('.homeContainer');
	stopWatch();
	//TODO
	resetValues();
}

function loadStat(){
	toggleOthers('.statContainer');
	//TODO	
}

function loadHome(){
	toggleOthers('.homeContainer');
	//TODO
}

function loadSettings(){
	toggleOthers('.settingsContainer');
	//TODO
}
function loadResults(){
	toggleOthers('.resultContainer');
	stopWatch();
	//TODO
}