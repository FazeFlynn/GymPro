const videoInput = document.getElementById("videoInput");
const selectVideo = document.getElementById("selectVideo");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const repsCountEl = document.getElementById("repsCount");
const vidCon = document.getElementById("vid-con");
const startBtn = document.getElementById("str-btn");
const startButton = document.getElementById("start");
const summary = document.getElementById("summ");
const summText = document.getElementById("summ-text");
const currCount = document.getElementById("curr-count");
const cam = document.getElementById("cam");
const trackPoints = document.getElementById("Track-P");

console.log("Came in Squats");

let squatCount = 0;
let isSquatting = false;
let pose;
let smoothedKeypoints = {};
const alpha = 0.6; // Smoothing factor
let isLiveTracking = false;




selectVideo.addEventListener("click", () => videoInput.click());

// Load selected video
videoInput.addEventListener("change", (event) => {
    toogleButtons();
    isLiveTracking = false;
    stopCamera();
  
    const file = event.target.files[0];
    console.log("Video selected");

    if (file) {
        video.src = URL.createObjectURL(file);
        video.load();
    }
});


function toogleButtons() {
    vidCon.style.display = "flex";
    startBtn.style.display = "flex";
    cam.style.display = "none";
    selectVideo.textContent = "Select a new Video";

    currCount.style.display = "flex";
    summary.style.display = "none";
    startBtn.style.display = "flex";
}



startButton.addEventListener("click", () => {
    video.playbackRate = 0.08;
    if (video.paused) {
        video.play();
        startButton.textContent = "Stop Tracking"
    } else {
        video.pause();
    }
});


function startCamera() {
    isLiveTracking = true;
    stopCamera();
    toogleButtons();
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

// Toggle tracking points visibility
let tp = true;
trackPoints.addEventListener("click", () => {
    canvas.style.opacity = tp ? "0%" : "100%";
    trackPoints.textContent = tp ? "Show Tracking Points" : "Hide Tracking Points";
    tp = !tp;
});

// Start Pose Tracking
async function startPoseTracking() {
    // return new Promise((resolve, reject) => {
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



        // console.log("BlazePose model loaded");

        if (isLiveTracking) {
            processLiveVideo();
        } else {
            video.addEventListener("play", () => {
                processVideo();
            });
        }

}

async function processVideo() {
    console.log("process video running");
    if (video.paused || video.ended) return;
    await pose.send({ image: video });
    requestAnimationFrame(processVideo);
}

async function processLiveVideo() {
    if (!isLiveTracking) return;
    await pose.send({ image: video });
    requestAnimationFrame(processLiveVideo);
}

// Helper function to smooth keypoints
function smoothKeypoint(index, x, y) {
    if (!smoothedKeypoints[index]) {
        smoothedKeypoints[index] = { x, y };
    } else {
        smoothedKeypoints[index].x = alpha * smoothedKeypoints[index].x + (1 - alpha) * x;
        smoothedKeypoints[index].y = alpha * smoothedKeypoints[index].y + (1 - alpha) * y;
    }
}

// Function to process pose landmarks and detect squats
function processPose(keypoints) {
    console.log("process Pose running");

    // Left and Right keypoints for squats
    const leftPoints = [23, 25, 27];  // Left hip, knee, ankle
    const rightPoints = [24, 26, 28]; // Right hip, knee, ankle

    console.log("process Pose poits setups");

    // Calculate visibility scores
    const leftVisibility = leftPoints.reduce((sum, idx) => sum + (keypoints[idx]?.visibility || 0), 0) / leftPoints.length;
    const rightVisibility = rightPoints.reduce((sum, idx) => sum + (keypoints[idx]?.visibility || 0), 0) / rightPoints.length;

    console.log("process Pose visiblity score");


    // Select the side with higher visibility
    let hipIndex, kneeIndex, ankleIndex;
    if (rightVisibility >= leftVisibility) {
        [hipIndex, kneeIndex, ankleIndex] = rightPoints;
    } else {
        [hipIndex, kneeIndex, ankleIndex] = leftPoints;
    }

    // Smooth selected keypoints
    [hipIndex, kneeIndex, ankleIndex].forEach(index => {
        smoothKeypoint(index, keypoints[index].x, keypoints[index].y);
    });

    // Draw keypoints
    [hipIndex, kneeIndex, ankleIndex].forEach(index => {
        const { x, y } = smoothedKeypoints[index];
        ctx.beginPath();
        ctx.arc(x * canvas.width, y * canvas.height, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "purple"; 
        ctx.fill();
    });

    // Squat detection logic
    const hipY = smoothedKeypoints[hipIndex].y;
    const kneeY = smoothedKeypoints[kneeIndex].y;
    const ankleY = smoothedKeypoints[ankleIndex].y;

    // Going down (hip below knee)
    if (hipY > kneeY && !isSquatting) {
        isSquatting = true;
    } 
    // Coming up (hip above knee again)
    else if (hipY < kneeY && isSquatting) {
        squatCount++;
        repsCountEl.textContent = squatCount;
        isSquatting = false;
        //
    }

    video.playbackRate = 0.9;
}

// Handle pose results
function onResults(results) {
    if (!results.poseLandmarks) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    processPose(results.poseLandmarks);
}

video.addEventListener('ended', function() {
    currCount.style.display = "none";
    summary.style.display = "flex";
    startBtn.style.display = "none";
    // trackPoints.style.display = "none";
    summText.textContent = "You have Performed " +squatCount + " Reps and 1 Sets in this video, Carry on!!"
    
});

const playAgain = document.getElementById("p-again");

playAgain.addEventListener("click", () => {   
    console.log("again clicked"); 
    video.play();
    toogleButtons();
    squatCount = 0;
    repsCountEl.textContent = squatCount;
});

startPoseTracking();