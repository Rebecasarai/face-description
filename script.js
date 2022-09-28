var model;
var tts;

const dataset_dict = {
    'age_id': {
        0: '0-18',
        1: '18-25',
        2: '25-35',  
        3: '35-45', 
        4: '45-55', 
        5: '55-65',
        6: '>65'
    },
    'expression_id': {
        0: 'molest@',  
        1: 'miedo o sorpresa', 
        2: 'feliz', 
        3: 'neutral',
        4: 'triste'
    },
    'gender_id': {
        0: "Hombre",
        1: "Mujer"
    },
    'hair_id': {
        0: 'cabello negro',
        1: 'cabello rubio',
        2: 'cabello castaño',
        3: 'cabello gris',
    },
    'bald_id': {
        0: "sin calvicie",
        1: "calv@"
    },
    'eyeglasses_id': {
        0: "sin gafas",
        1: "con gafas"
    }
}

let predictions= '';

var video_width=900;
var video_height=680;



//openCvReady is the function that will be executed when the opencv.js file is loaded
function openCvReady() {
  cv['onRuntimeInitialized']= ()=>{
    // The variable video extracts the video the video element
    //let video = document.getElementById("cam_input"); // video is the id of video tag
    let video = document.createElement('video');
    //video id="cam_input" height="100%" width="100%" autoplay muted playsinline
    video.setAttribute('id', 'cam_input');
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    //video.setAttribute('height', '100%');
    //video.setAttribute('width', '100%');

    let canvas = document.createElement('canvas');
    canvas.setAttribute('id', 'canvas_output');

    document.body.append(video);
    document.body.append(canvas);
    
    
    /*console.log("offset "+video.offsetWidth);
    console.log("width "+video.width);
    console.log("clientWidth "+video.clientWidth);
    console.log("scrollWidth "+video.scrollWidth);*/
    
    
    // navigator.mediaDevices.getUserMedia is used to access the webcam
    navigator.mediaDevices.getUserMedia({ video: {facingMode: "environment"}, audio: false, 
    })
    .then(function(stream) {
        video.srcObject = stream;
        let {width, height} = stream.getTracks()[0].getSettings();
        console.log(`${width}x${height}`); // 640x480

        console.log(width);
        console.log(height );


        var w = (window.innerWidth > 0) ? window.innerWidth : screen.width;
        var h = (window.innerHeight > 0) ? window.innerHeight : screen.height;
        console.log("width: "+w);
        /*alert("wxh:"+ w+"x"+h+".  clientWidth x clientHeight:"+
                video.clientWidth+"x"+video.clientHeight+".  scrollWidth x scrollHeight:"+
                video.scrollWidth+"x"+video.scrollHeight +".\n cameraWidth x cameraHeight:"+width+"x"+height);*/

        if (w < 700){
            //this.video_width=480;
            //this.video_height=640;
            video.setAttribute('width', 480);
            video.setAttribute('height', 640);
        }else{
            video.setAttribute('width', width);
            video.setAttribute('height', height);

        }
        video.play();
            
        setTimeout(openCvReady, 3000);
        continueOpenCV(video);
    })
    .catch(function(err) {  
        console.log("An error occurred! " + err);
    });
   
  }

}


/**
 * Creates the web native text to speak interface
 * @returns object for text to speak
 */
 function createTts(){
    var msg = new SpeechSynthesisUtterance();
    msg.lang = 'es-ES';
    return msg
}
/**
 * Speaks given a text message
 * @param {*} tts Text to speak object
 * @param {*} msgText Text to be speaked outload.
 */
function speak(tts, msgText){
    if ('speechSynthesis' in window) {
        
        // Speech Synthesis supported 
        tts.text = msgText;        
        window.speechSynthesis.lang = 'es-ES';
        window.speechSynthesis.speak(tts);
       }else{
         // Speech Synthesis Not Supported 
         alert("¡Lo sentimos, su navegador no admite texto a voz!");
       }
}
    


function continueOpenCV(video){
    //src and dst holds the source and destination image matrix
    let src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
    let dst = new cv.Mat(video.height, video.width, cv.CV_8UC1);
    //gray holds the grayscale image of the src
    let gray = new cv.Mat();
    let rgb_copy = new cv.Mat();
    //cap holds the current frame of the video
    let cap = new cv.VideoCapture(cam_input);
    //RectVector is used to hold the vectors of different faces
    let faces = new cv.RectVector();
    predictions="Detecting..."
    //classifier holds the classifier object
    let classifier = new cv.CascadeClassifier();
    let utils = new Utils('errorMessage');
    //crop holds the ROI of face
    let crop=new cv.Mat(video.height, video.width, cv.CV_8UC1);
    let dsize = new cv.Size(218, 218);

    // Loading the haar cascade face detector
    let faceCascadeFile = 'haarcascade_frontalface_default.xml'; // path to xml
    utils.createFileFromUrl(faceCascadeFile, faceCascadeFile, () => {
    classifier.load(faceCascadeFile); // in the callback, load the cascade from file 
});


/**Loading the model with async as loading the model may take few miliseconds
   The function dont take and return anything the model holds the model**/
var modelLoaded = false;
(async () => {
    this.tts=createTts()
    speak(this.tts, "Cargando modelo");
    model = await tf.loadLayersModel('./model/latest_31_08_2022_small_3_quantize_uint16/model.json')//.then(() => {
        
    console.log(tf.getBackend());
    //tf.setBackend('cpu');
    speak(this.tts, "Modelo cargado, puede tocar para escuchar descripción de personas");
    console.log("Modelo: "+ model);
    modelLoaded=true;
   
 })()

 const FPS = 30;
 //tf.setBackend('webgl');
 // processvideo will be executed recurrsively 
 function processVideo() {
     let begin = Date.now();
     cap.read(src);
     src.copyTo(dst);
     cv.cvtColor(dst, gray, cv.COLOR_RGBA2GRAY, 0); // converting to grayscale
     cv.cvtColor(dst, rgb_copy, cv.COLOR_RGBA2RGB, 0);
     try{
         classifier.detectMultiScale(gray, faces, 1.1, 3, 0);// detecting the face
         //console.log(faces.size());
     }catch(err){
         console.log(err);
     }
     //iterating over all the detected faces
     for (let i = 0; i < faces.size(); ++i) {
         let face = faces.get(i);
         // filtering out the boxes with the area of less than 45000
         if(face.width*face.height <40000){continue;} 
         let point1 = new cv.Point(face.x, face.y-50);
         let point2 = new cv.Point(face.x + face.width, face.y-50 + face.height+70);
         //console.log(point1, point2);
         // creating the bounding box
         cv.rectangle(dst, point1, point2, [100, 255, 100, 255],3);
         //creating a rect element that can be used to extract
         let cutrect=new cv.Rect(face.x-10,face.y-40,face.width+10,face.height+80)
         //extracting the ROI
         crop=rgb_copy.roi(cutrect)
         //cv.cvtColor(crop, crop, cv.COLOR_RGBA2RGB, 0)

         cv.resize(crop,crop,dsize,0,0,cv.INTER_AREA)
    
     //converting the image matrix to a 4d tensor
     //const input=tf.tensor4d(crop.data,[1,48,48,4]).div(255)
     


     //console.log(input)
     //making the prediction and adding the prediction it to the output canvas
    
     
     try{
        let input = tf.tensor(crop.data, [1, crop.rows, crop.cols, 3])//.div(255);
        predictions=model.predict(input);
        console.log("Predicciones")
        console.log(predictions)
        console.log(
            String(dataset_dict['gender_id'][parseInt(predictions[2].argMax(1).dataSync())])+
            " de "+ String(dataset_dict['age_id'][parseInt(predictions[0].argMax(1).dataSync())]) +
            ", " + String(dataset_dict['expression_id'][parseInt(predictions[1].argMax(1).dataSync())]) +
            ", "+ String( dataset_dict['hair_id'][parseInt(predictions[3].dataSync())])+
            ", "+ String( dataset_dict['bald_id'][parseInt(predictions[4].dataSync())])+
            ", "+ String( dataset_dict['eyeglasses_id'][parseInt(predictions[5].dataSync())])
        );
                /*console.log("Edad: "+ String(dataset_dict['age_id'][parseInt(predictions[0].dataSync())])+
        ", Exp: "+ String( dataset_dict['expression_id'][parseInt(predictions[1].dataSync())])+
        ", Genero: "+ String( dataset_dict['gender_id'][parseInt(predictions[2].dataSync())])+
        ", Cabello: "+ String( dataset_dict['hair_id'][parseInt(predictions[3].dataSync())])+
        ", Calvo: "+ String( dataset_dict['bald_id'][parseInt(predictions[4].dataSync())])+
        ", Gafas: "+ String( dataset_dict['eyeglasses_id'][parseInt(predictions[5].dataSync())]))*/
         //console.log(predictions[0].dataSync())
         //adding the text above the bounding boxes
         
         cv.putText(dst,
            String(dataset_dict['gender_id'][parseInt(predictions[2].argMax(1).dataSync())])+
            " de "+ String(dataset_dict['age_id'][parseInt(predictions[0].argMax(1).dataSync())]) +
            " " + String(dataset_dict['expression_id'][parseInt(predictions[1].argMax(1).dataSync())]) +", ",
            {x:face.x,y:face.y-90},1,1,[100, 255, 100, 255],1);
            
            
        cv.putText(dst,   
            String( dataset_dict['hair_id'][parseInt(predictions[3].dataSync())])+
            ", "+ String( dataset_dict['bald_id'][parseInt(predictions[4].dataSync())]) +", ",
            {x:face.x,y:face.y-80},1,1,[100, 255, 100, 255],1);

        cv.putText(dst,
            String( dataset_dict['eyeglasses_id'][parseInt(predictions[5].dataSync())]),
            {x:face.x,y:face.y-70},1,1,[100, 255, 100, 255],1);
        
    }catch(err){
        if (modelLoaded==true){
            console.log(err);
            
        }else{
            cv.putText(dst,"Cargando modelo",{x:face.x,y:face.y-60},1,1,[100, 255, 100, 255],1);
        }
    }
     
     }
   

     // showing the final output
     cv.imshow("canvas_output", dst);
    
     //let delay = 1000/FPS - (Date.now() - begin);
     let delay = 1000/FPS - (Date.now() - begin);
     setTimeout(processVideo, delay);
}
// schedule first one.
setTimeout(processVideo, 0);
}


window.addEventListener("click", function(event) {


    if(modelLoaded==False){
        if (this.tts == null){
            this.tts = createTts();
            //this.tts = new SpeechSynthesisUtterance();
            //this.tts.lang = 'es-ES';
        }

        // Speech Synthesis supported 
        //this.tts.text = texto;        
        //window.speechSynthesis.lang = 'es-ES';
        //window.speechSynthesis.speak(this.tts);
        speak(this.tts, "Cargando modelo, espero un par de segundos por favor.")
    }

    //if (event.detail === 3) {
    

    let texto = "No se ha detectado caras recientemente."
    if (predictions !== ''){
        texto = String(dataset_dict['gender_id'][parseInt(predictions[2].argMax(1).dataSync())])+
        " de "+ String(dataset_dict['age_id'][parseInt(predictions[0].argMax(1).dataSync())]) +
        ", " + String(dataset_dict['expression_id'][parseInt(predictions[1].argMax(1).dataSync())]) +", con " +       
        String( dataset_dict['hair_id'][parseInt(predictions[3].dataSync())])+
        ", "+ String( dataset_dict['bald_id'][parseInt(predictions[4].dataSync())]) +", "
        String( dataset_dict['eyeglasses_id'][parseInt(predictions[5].dataSync())])
        
    if ('speechSynthesis' in window) {
        if (this.tts == null){
            this.tts = createTts();
            //this.tts = new SpeechSynthesisUtterance();
            //this.tts.lang = 'es-ES';
        }

        // Speech Synthesis supported 
        //this.tts.text = texto;        
        //window.speechSynthesis.lang = 'es-ES';
        //window.speechSynthesis.speak(this.tts);
        speak(this.tts,texto)
       }else{
         // Speech Synthesis Not Supported 
         alert("¡Lo sentimos, su navegador no admite texto a voz!");
       }
    } else{
        if (this.tts == null){
            this.tts = createTts();
            //this.tts = new SpeechSynthesisUtterance();
            //this.tts.lang = 'es-ES';
        }

        // Speech Synthesis supported 
        //this.tts.text = texto;        
        //window.speechSynthesis.lang = 'es-ES';
        //window.speechSynthesis.speak(this.tts);
        speak(this.tts, "No han habido rostros detectados recientemente.")
    }
    
    
//}
    
}
);
