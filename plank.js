const videoInput = document.getElementById("videoInput");
const selectVideo = document.getElementById("selectVideo");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const plankTimeEl = document.getElementById("repsCount");
const vidCon = document.getElementById("vid-con");
const startBtn = document.getElementById("str-btn");
const startButton = document.getElementById("start");
const summary = document.getElementById("summ");
const summText = document.getElementById("summ-text");
const cam = document.getElementById("cam");
const trackPoints = document.getElementById("Track-P");
const playAgain = document.getElementById("p-again");

console.log("Plank tracking started...");

let timer;

let isPlanking = false;
let startTime = 0;
let totalPlankTime = 0;
let smoothedKeypoints = {};
const alpha = 0.6; // Smoothing factor
let isLiveTracking = false;

selectVideo.addEventListener("click", () => videoInput.click());

videoInput.addEventListener("change", (event) => {
    toggleButtons();
    isLiveTracking = false;
    stopCamera();
    const file = event.target.files[0];

    if (file) {
        video.src = URL.createObjectURL(file);
        video.load();
    }
});

function toggleButtons() {
    vidCon.style.display = "flex";
    startBtn.style.display = "flex";
    cam.style.display = "none";
    selectVideo.textContent = "Select a new Video";

    summary.style.display = "none";
    startBtn.style.display = "flex";
}

startButton.addEventListener("click", () => {
    if (video.paused) {
        video.play();
        startButton.textContent = "Stop Tracking";
    } else {
        video.pause();
    }
});

function startCamera() {
    isLiveTracking = true;
    stopCamera();
    toggleButtons();
    vidCon.classList.add("mirrored");
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then((stream) => {
                video.srcObject = stream;
                video.play();
            })
            .catch((error) => console.error("Error accessing camera:", error));
    } else {
        console.error("getUserMedia not supported.");
    }
}

cam.addEventListener("click", startCamera);

function stopCamera() {
    if (video.srcObject) {
        let tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
}

let tp = true;
trackPoints.addEventListener("click", () => {
    canvas.style.opacity = tp ? "0%" : "100%";
    trackPoints.textContent = tp ? "Show Tracking Points" : "Hide Tracking Points";
    tp = !tp;
});

async function startPoseTracking() {
    pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6
    });

    pose.onResults(onResults);
    console.log("BlazePose model loaded");

    if (isLiveTracking) {
        processLiveVideo();
    } else {
        video.addEventListener("play", () => {
            processVideo();
        });
    }
}

async function processVideo() {
    if (video.paused || video.ended) return;
    await pose.send({ image: video });
    requestAnimationFrame(processVideo);
}

async function processLiveVideo() {
    if (!isLiveTracking) return;
    await pose.send({ image: video });
    requestAnimationFrame(processLiveVideo);
}

function smoothKeypoint(index, x, y) {
    if (!smoothedKeypoints[index]) {
        smoothedKeypoints[index] = { x, y };
    } else {
        smoothedKeypoints[index].x = alpha * smoothedKeypoints[index].x + (1 - alpha) * x;
        smoothedKeypoints[index].y = alpha * smoothedKeypoints[index].y + (1 - alpha) * y;
    }
}

// **Function to process pose landmarks and detect plank**
function processPose(keypoints) {
    console.log("Processing Pose for Plank...");

    // Select the most visible side (left or right)
    const leftPoints = [11, 23, 25]; // Left shoulder, hip, ankle
    const rightPoints = [12, 24, 26]; // Right shoulder, hip, ankle

    const leftVisibility = leftPoints.reduce((sum, idx) => sum + (keypoints[idx]?.visibility || 0), 0) / leftPoints.length;
    const rightVisibility = rightPoints.reduce((sum, idx) => sum + (keypoints[idx]?.visibility || 0), 0) / rightPoints.length;

    let shoulderIndex, hipIndex, ankleIndex;
    if (rightVisibility >= leftVisibility) {
        [shoulderIndex, hipIndex, ankleIndex] = rightPoints;
    } else {
        [shoulderIndex, hipIndex, ankleIndex] = leftPoints;
    }

    // Smooth keypoints
    [shoulderIndex, hipIndex, ankleIndex].forEach(index => {
        const { x, y } = keypoints[index];

        if (!smoothedKeypoints[index]) {
            smoothedKeypoints[index] = { x, y };
        } else {
            smoothedKeypoints[index].x = alpha * smoothedKeypoints[index].x + (1 - alpha) * x;
            smoothedKeypoints[index].y = alpha * smoothedKeypoints[index].y + (1 - alpha) * y;
        }
    });

    // Draw keypoints
    [shoulderIndex, hipIndex, ankleIndex].forEach(index => {
        const { x, y } = smoothedKeypoints[index] || keypoints[index];

        ctx.beginPath();
        ctx.arc(x * canvas.width, y * canvas.height, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "purple"; 
        ctx.fill();
    });

    // Plank Detection - Check if body is in a straight line
    const shoulderY = smoothedKeypoints[shoulderIndex].y;
    const hipY = smoothedKeypoints[hipIndex].y;
    const ankleY = smoothedKeypoints[ankleIndex].y;

    const hipAngle = Math.abs(shoulderY - hipY) / Math.abs(hipY - ankleY);

    if (hipAngle >= 0.9 && hipAngle <= 1.1) { // Adjust this range for accuracy
        if (!isPlanking) {
            isPlanking = true;
            timer = startTimer(plankTimeEl);
            timer.start();
            startTime = performance.now(); // Start the timer
        }
    } else {
        if (isPlanking) {
            totalPlankTime += (performance.now() - startTime) / 1000; // Convert ms to seconds
            timer.stop();
            isPlanking = false;
        }
    }

    // Update UI with plank time
    plankTimeEl.textContent = isPlanking
        ? `${((performance.now() - startTime) / 1000 + totalPlankTime).toFixed(2)} sec`
        : `${totalPlankTime.toFixed(2)} sec`;
}


function startTimer(displayElement) {
    let seconds = 0;
    let timerInterval;

    function formatTime(sec) {
        let hrs = Math.floor(sec / 3600).toString().padStart(2, '0');
        let mins = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
        let secs = (sec % 60).toString().padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
    }

    function updateTimer() {
        displayElement.textContent = formatTime(seconds);
        seconds++;
    }

    return {
        start: function () {
            if (!timerInterval) {
                timerInterval = setInterval(updateTimer, 1000);
            }
        },
        stop: function () {
            clearInterval(timerInterval);
            timerInterval = null;
        },
        reset: function () {
            seconds = 0;
            displayElement.textContent = formatTime(seconds);
        }
    };
}



function onResults(results) {
    if (!results.poseLandmarks) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    processPose(results.poseLandmarks);
}

video.addEventListener('ended', function() {
    summary.style.display = "flex";
    startBtn.style.display = "none";
    summText.textContent = `You held a plank for ${totalPlankTime.toFixed(2)} seconds!`;
});

playAgain.addEventListener("click", () => {   
    console.log("again clicked"); 
    video.play();
    toggleButtons();
    totalPlankTime = 0;
    plankTimeEl.textContent = "0 sec";
});

// timer.reset();

startPoseTracking();
