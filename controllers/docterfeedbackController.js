const doctorFeedbackSettingsCollection = require("../models/feedBackSettings");

//  endpoint "/api/doctorFeedback/createFeedback" 
// this will receive details to create the document in doctorFeedbackSettings 
exports.createFeedback = async (req,res) => {
    const doctorId = req.user._id;

    const {generalQuery , newConsultation, opinionConsultation, existingConsultation , messengerUsecase , afterXhours, purpose ,totalQuestions} = req.body;

    // call that gork api and save questions in this area

    const data = {
        doctorId,
        generalQuery ,
        newConsultation, 
        opinionConsultation, 
        existingConsultation , 
        messengerUsecase , 
        afterXhours, 
        purpose ,
        totalQuestions

    };

    try {
        const result = await doctorFeedbackSettingsCollection.insertOne(data);

        if(!result){
            console.log("Not inserted : ",result);
            return res.status(401).json({message : "not inserted "});
        }

        console.log("successfully inserted ");
        return res.status(201).json({message : "inserted successfully ",result : result});
    }
    catch(error){
        console.log("error in inserting data into the collection ",error);
        return res.status(500).json({message : "error occurs in inserting data in collection "})
    }
    
}

exports.editFeedback = async (req,res) =>{
    //
}

exports.viewFeedback = async (req,res)=>{
    // 
    const doctorId = req.user._id;

    try{
        const result = await doctorFeedbackSettingsCollection.find({doctorId:doctorId});
        if(!result){
            console.log("Doctor not found");
            return res.json({message:"doctor not found in database"});
        }

        console.log("doctor found : ",result);
        return res.json({message : "doctor found",result : result});
    }
    catch(error){
        console.log("error in database fetching ",error);
        return res.status(500).json({message : "error in database fetching "});
    }
}

exports.getQuestions = async(req,res)=>{

}

