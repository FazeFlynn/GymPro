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
const playAgain = document.getElementById("p-again");

console.log("Dips tracking started...");

let dipCount = 0;
let isDipping = false;
let pose;
let smoothedKeypoints = {};
const alpha = 0.6; // Smoothing factor
let isLiveTracking = false;

selectVideo.addEventListener("click", () => videoInput.click());

videoInput.addEventListener("change", (event) => {
    toggleButtons();
    
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

    currCount.style.display = "flex";
    summary.style.display = "none";
    startBtn.style.display = "flex";
}

startButton.addEventListener("click", () => {
    video.playbackRate = 0.08;
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

// function mirrorVideo() {
//     ctx.save();
//     ctx.scale(-1, 1); // Flip horizontally
//     ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
//     ctx.restore();
//     requestAnimationFrame(mirrorVideo);
// }

// video.addEventListener("play", mirrorVideo);

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

// Function to process pose landmarks and detect dips
function processPose(keypoints) {
    console.log("Processing Pose for Dips...");

     // Check visibility of left and right side keypoints
     const leftPoints = [0, 11, 13, 15, 23, 25]; // Left shoulder, elbow, wrist
     const rightPoints = [0, 12, 14, 16, 24, 26]; // Right shoulder, elbow, wrist
 
     const leftVisibility = leftPoints.reduce((sum, idx) => sum + (keypoints[idx]?.visibility || 0), 0) / leftPoints.length;
     const rightVisibility = rightPoints.reduce((sum, idx) => sum + (keypoints[idx]?.visibility || 0), 0) / rightPoints.length;

   
     // Select the side with higher average visibility
    let shoulderIndex, elbowIndex, wristIndex;
    if (rightVisibility >= leftVisibility) {
        [noseIndex, shoulderIndex, elbowIndex, wristIndex, hipsIndex, angleIndex] = rightPoints;
    } else {
        [noseIndex, shoulderIndex, elbowIndex, wristIndex, hipsIndex, angleIndex] = leftPoints;
    }



    // Smooth selected keypoints
    [noseIndex, shoulderIndex, elbowIndex, wristIndex, hipsIndex, angleIndex].forEach(index => {
        const { x, y } = keypoints[index];

        if (!smoothedKeypoints[index]) {
            smoothedKeypoints[index] = { x, y };
        } else {
            smoothedKeypoints[index].x = alpha * smoothedKeypoints[index].x + (1 - alpha) * x;
            smoothedKeypoints[index].y = alpha * smoothedKeypoints[index].y + (1 - alpha) * y;
        }
    });

    // Drawing keypoints here
    [noseIndex, shoulderIndex, elbowIndex, wristIndex, hipsIndex, angleIndex].forEach(index => {
        const { x, y } = smoothedKeypoints[index] || keypoints[index];

        ctx.beginPath();
        ctx.arc(x * canvas.width, y * canvas.height, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "purple"; 
        ctx.fill();
    });


   
    const wristY = smoothedKeypoints[wristIndex].y;
    const HipY = smoothedKeypoints[hipsIndex].y;
    // const shoulderY = smoothedKeypoints[shoulderIndex].y;


    // Dip Down condition: Elbows bend, shoulders move down significantly
    if (wristY < HipY && !isDipping) {
        isDipping = true;
    }
    // Dip Up condition: Shoulders move up, elbows straighten
    else if (wristY > HipY && isDipping) {
        dipCount++;
        repsCountEl.textContent = dipCount;
        isDipping = false;
    }

    video.playbackRate = 0.9;
}

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
    summText.textContent = `You have performed ${dipCount} reps of dips in this video. Keep pushing!`;
});



playAgain.addEventListener("click", () => {   
    console.log("again clicked"); 
    video.play();
    toggleButtons();
    dipCount = 0;
    repsCountEl.textContent = dipCount;
});

startPoseTracking();
