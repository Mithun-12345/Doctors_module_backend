const { default: mongoose } = require("mongoose");
const {DoctorQuestionMapWithQuery,DoctorfeedbackSettings} = require("../models/feedBackSettings");

const {generateFeedbackQuestions,regenerateSingleQuestion} = require("./grokFunction");

//  endpoint "/api/doctorFeedback/createFeedback" 
// this will receive details to create the document in doctorFeedbackSettings 

    // const doctorId = req.user._id;

    // const {generalQueryvalue , newConsultationvalue , opinionConsultationvalue , existingConsultationvalue , messengerUsecase , afterXhours, purpose ,totalQuestions} = req.body;



    // const generalQuery = {
    //     isAvailable : generalQueryvalue
    // };

    // const newConsultation = {
    //     isAvailable : newConsultationvalue
    // };
    // const existingConsultation = {
    //     isAvailable : existingConsultationvalue
    // };
    // const opinionConsultation = {
    //     isAvailable : opinionConsultationvalue
    // };

    // let createdAt = Date.now();

    // const data = {
    //     doctorId,
    //     generalQuery,
    //     newConsultation,
    //     opinionConsultation,
    //     existingConsultation,
    //     createdAt
    // }
    // // insert in DoctorQuestionfeedbacksettings 
    // try{
    //     let result = await DoctorfeedbackSettings.insertOne(data);
    //     if(!result){
    //         console.log("Not inserted : ",result);
    //         return res.status(401).json({message : "not inserted "});
    //     }

    //     console.log("successfully inserted ");
    //     // res.status(201).json({message : "inserted successfully ",result : result});
    // }
    // catch(error){
    //     console.log("error in inserting ",error);
    //     return res.status(500).json({message : "error in inserting "});
    // }

exports.createDoctorForFeedbackOption = async(req,res)=>{
    const doctorId = req.user._id;

    try {
        const result = await DoctorfeedbackSettings.findOne({doctorId : doctorId});
        console.log(result);

        if(!result){
            await DoctorfeedbackSettings.create({doctorId:doctorId,createdAt : Date.now()});
            console.log("doctor feed back created ");
            return res.json({message : "doctor feed back created"});
        }

        console.log("doctor feed back already created ");
        return res.json({message : "doctor feed back already  created"});
    }
    catch(error){
        console.log("error in database insertion");
        res.status(500).json({message : "error in database insertion"});
    }

}

exports.getDoctorFeedbackOption = async (req,res)=>{
    const doctorId = req.user._id;

    try{
        const result = await DoctorfeedbackSettings.findOne({doctorId : doctorId});

        if(!result){
            console.log("doctor id not present in database");
            return res.json({message : "doctorid not present in database"});
        }

        console.log("successfully fetched");
        return res.status(200).json({message : "success",result : result});
    }
    catch(error){
        console.log("error in fetching data");
        return res.status(500).json({message : "error in fetching data "});
    }
}

exports.editDoctorFeedbackOption = async (req, res) => {
    const doctorId = req.user._id;
    const queryId = new mongoose.Types.ObjectId(req.params.queryId); // ensure ObjectId

    try {
        // Step 1: Find doctor document
        const doc = await DoctorfeedbackSettings.findOne({ doctorId });

        if (!doc) {
            return res.status(404).json({ message: "Doctor not found" });
        }

        // Step 2: Determine which query field matches and toggle value
        let updateField = null;
        let currentValue = null;

        if (doc.generalQuery?._id?.equals(queryId)) {
            updateField = "generalQuery.isAvailable";
            currentValue = doc.generalQuery.isAvailable;
        } else if (doc.newConsultation?._id?.equals(queryId)) {
            updateField = "newConsultation.isAvailable";
            currentValue = doc.newConsultation.isAvailable;
        } else if (doc.opinionConsultation?._id?.equals(queryId)) {
            updateField = "opinionConsultation.isAvailable";
            currentValue = doc.opinionConsultation.isAvailable;
        } else if (doc.existingConsultation?._id?.equals(queryId)) {
            updateField = "existingConsultation.isAvailable";
            currentValue = doc.existingConsultation.isAvailable;
        }

        if (!updateField) {
            return res.status(404).json({ message: "Query ID not found in doctor record" });
        }

        // Step 3: Toggle value
        const newValue = !currentValue;

        await DoctorfeedbackSettings.updateOne(
            { doctorId },
            { $set: { [updateField]: newValue } }
        );

        res.json({ message: `isAvailable toggled to ${newValue} for ${updateField}` });

    } catch (error) {
        console.error("Error updating availability", error);
        res.status(500).json({ message: "Server error" });
    }
};

exports.createDoctorFeedback = async (req,res) => {

    
    // call that gork api and save questions in this area
    const doctorId = req.user._id;

    const {messengerUsecase,purpose,totalQuestions,afterXhours} = req.body;

    const response = await generateFeedbackQuestions(messengerUsecase,purpose,totalQuestions,0,0);
    console.log("ouput from grok  : ",response);
    const questions = response.questions;
    const questionsName = response.feedbackName;

    const output = await DoctorfeedbackSettings.findOne({doctorId : doctorId});

    const generalQueryId = output.generalQuery._id;
    const newConsultationId = output.newConsultation._id;
    const existingConsultationId = output.existingConsultation._id;
    const opinionConsultationId = output.opinionConsultation._id;

    let queryId;
    // find the true query 0    
    if(messengerUsecase == "generalQuery"){
        queryId = generalQueryId;
    }
    else if(messengerUsecase == "newConsultation"){
        queryId = newConsultationId;
    }
    else if(messengerUsecase == "opinionConsultation"){
        queryId = opinionConsultationId;
    }
    else if(messengerUsecase == "existingConsultation"){
        queryId = existingConsultationId;
    }

    createdAt = Date.now();
    const data1 = {
        doctorId,
        queryId,
        messengerUsecase , 
        afterXhours, 
        purpose ,
        totalQuestions,
        questionsName,
        questions,
        createdAt
    };

    try {
        const result = await DoctorQuestionMapWithQuery.insertOne(data1);

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

exports.editFeedbackParticularQuestion = async (req,res) =>{
    //
    const doctorId = req.user._id;
    const { oldQuestion,messengerUseCase, feedbackPurpose,questionId } = req.body;

    if(!oldQuestion || !messengerUseCase || !feedbackPurpose || !questionId){
        console.log("give the input from frontend correctly");
        return res.status(404).json({message : "invalid input from frontend"});
    }

    const newQuestion = await regenerateSingleQuestion(
        oldQuestion,
        messengerUseCase,
        feedbackPurpose
        );
    console.log("new question : ",newQuestion);

    try{
        const doc = await DoctorQuestionMapWithQuery.findOne({
            doctorId: doctorId,
            messengerUsecase: messengerUseCase
        });
        
        if (!doc) {
            return res.status(404).json({ message: "Feedback record not found" });
        }
        console.log("hi 1");
        
        const result = await DoctorQuestionMapWithQuery.updateOne(
            {
                doctorId: doctorId,
                messengerUsecase: messengerUseCase,
                "questions._id": questionId
            },
            {
                $set: {
                    "questions.$.question": newQuestion.trim(),
                    updatedAt: new Date()
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "No matching question found" });
        }

        // return res.json({ message: "Question updated successfully" });

        return res.json({
            message: "Question updated successfully",
            updatedDoc: doc
        });


    }
    catch(error){
        console.log("error in database insertion ");
        return res.status(500).json({message: "error in database insertion"});
    }
}

exports.viewFeedbackQuestions = async (req, res) => {
    const doctorId = req.user._id;
    const { messengerUsecase } = req.body; //  extract the property properly

    try {
        const output = await DoctorQuestionMapWithQuery.findOne({
            doctorId: doctorId,
            messengerUsecase: messengerUsecase
        });

        if (!output) {
            return res.status(404).json({ message: "Doctor feedback not created" });
        }

        console.log("Fetched successfully");
        return res.json({
            message: "Data fetched successfully",
            output: output.questions
        });
    } catch (error) {
        console.error("Error fetching data from the database:", error);
        return res.status(500).json({
            message: "Error fetching data from the database"
        });
    }
};

exports.getQuestions = async(req,res)=>{

}

