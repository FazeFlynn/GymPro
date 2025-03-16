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


function startCamera() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(function(stream) {
          const videoElement = document.querySelector('video');
          
          videoElement.srcObject = stream;
  
          videoElement.play();
        })
        .catch(function(error) {
          console.error("Error accessing camera: ", error);
        });
    } else {
      console.error("getUserMedia not supported in this browser.");
    }
}

cam.addEventListener("click", startCamera);



let tp = true;
trackPoints.addEventListener("click",() => {
    if(tp){
        canvas.style.opacity = "0%";
        trackPoints.textContent = "Show Tracking Points";
        tp = false;
    } else {
        canvas.style.opacity = "100%";
        trackPoints.textContent = "Hide Tracking Points";
        tp = true;

    }

})


let repCount = 0;
let isDown = false;
let pose;
let fullBodyVisible = false; 

selectVideo.addEventListener("click", () => videoInput.click());

// Load selected video
videoInput.addEventListener("change", (event) => {
    vidCon.style.display = "flex";
    startBtn.style.display = "flex";
    cam.style.display = "none";
    selectVideo.textContent = "Select a new Video"
    const file = event.target.files[0];
    console.log("Video selected");
    if (file) {
        video.src = URL.createObjectURL(file);
        video.load();
        
    }
});




startButton.addEventListener("click", () => {
    video.playbackRate = 0.9;
    if (video.paused) {
        video.play();
        startButton.textContent = "Stop Tracking"
    } else {
        video.pause();
    }
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

    video.addEventListener("play", () => {
        processVideo();
    });
}

async function processVideo() {
    if (video.paused || video.ended) return;
    await pose.send({ image: video });
    requestAnimationFrame(processVideo);
}


// function adjustSpeed() {
//     if (video.playbackRate > 0.7) video.playbackRate -= 0.1;
// }
// setInterval(adjustSpeed, 2000);


function isFullBodyVisible(keypoints) {
    const requiredIndexes = [0, 12, 14, 16, 31]; // Head, Right Shoulder, Right Elbow, Right Wrist, Right Hip, Right Knee, Right Ankle
    const confidenceThreshold = 0.5;

    return requiredIndexes.every(index => keypoints[index] && keypoints[index].visibility > confidenceThreshold);
}

// Process pose results
function onResults(results) {
    if (!results.poseLandmarks) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    fullBodyVisible = isFullBodyVisible(results.poseLandmarks); // Check full body visibility

    processPose(results.poseLandmarks);
    
}

let smoothedKeypoints = {}; 

let smoothedElbow = { x: null, y: null }; 
const smoothingFactor = 0.7; 

function smoothKeypoint(original, smoothed, alpha) {
    if (smoothed.x === null || smoothed.y === null) {
        smoothed.x = original.x;
        smoothed.y = original.y;
    } else {
        smoothed.x = alpha * smoothed.x + (1 - alpha) * original.x;
        smoothed.y = alpha * smoothed.y + (1 - alpha) * original.y;
    }
}

function processPose(keypoints) {
    if (!fullBodyVisible) return; 
    
    const selectedIndexes = [0, 12, 14, 16, 31]; 
    const smoothIndexes = [12, 14]; 
    const alpha = 0.3;

    // Smooth selected keypoints
    smoothIndexes.forEach(index => {
        const { x, y } = keypoints[index];

        if (!smoothedKeypoints[index]) {
            smoothedKeypoints[index] = { x, y };
        } else {
            smoothedKeypoints[index].x = alpha * smoothedKeypoints[index].x + (1 - alpha) * x;
            smoothedKeypoints[index].y = alpha * smoothedKeypoints[index].y + (1 - alpha) * y;
        }
    });

    // Draw keypoints
    selectedIndexes.forEach(index => {
        const { x, y } = smoothedKeypoints[index] || keypoints[index]; // Use smoothed if available

        ctx.beginPath();
        ctx.arc(x * canvas.width, y * canvas.height, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "purple"; 
        ctx.fill();
    });


    const rightShoulder = smoothedKeypoints[12].y;
    const rightElbow = smoothedKeypoints[14].y;

    console.log("smoothly Counting reps");

    if (rightElbow > rightShoulder && !isDown) {
        isDown = true;
    } else if (rightElbow < rightShoulder && isDown) {
        repCount++;
        isDown = false;
        repsCountEl.textContent = repCount;
    }
}


function countReps(keypoints) {
    if (!fullBodyVisible) return; // Ensure reps count only when full body is visible

    const rightShoulder = keypoints[12].y;
    const rightElbow = keypoints[14].y;

    console.log("Counting reps");

    if (rightElbow > rightShoulder && !isDown) {
        isDown = true;
    } else if (rightElbow < rightShoulder + 0.05 && isDown) {
        repCount++;
        isDown = false;
        repsCountEl.textContent = repCount;
    }
}





video.addEventListener('ended', function() {
    currCount.style.display = "none";
    summary.style.display = "flex";
    startBtn.style.display = "none";
    // trackPoints.style.display = "none";
    summText.textContent = "You have Performed " + repCount + " Reps and 1 Sets in this video, Carry on!!"
    
});

startPoseTracking();