
const { default: mongoose } = require("mongoose");
const {generateFeedbackQuestions,regenerateSingleQuestion} = require("./grokFunction");
const {RescheduleAndRefund,DoctorQuestionMapWithQuery,DoctorfeedbackSettings,ClinicOperationHours,AppointmentSlotTypes,ConsultationPriorityMapping,ShipmentPanelSettings,PaymentIntimationPanel} = require("../models/consultationMessengerSettings");

// feed back panel

exports.createFeedbackPanel = async (req,res)=>{
    const doctorId = req.user._id;
    const {str} = req.body;

    try{
        await DoctorfeedbackSettings.create({doctorId:doctorId , msgUseCase : str});
        console.log("created");
        return res.status(201).json({message : "created"});
    }
    catch(error){
        console.log("Error in database",error);
        return res.status(500).json({message : "error in database"});
    }
};

exports.getFeedbackPanel = async(req,res)=>{
    const doctorId = req.user._id;
    try{
        const result = await DoctorfeedbackSettings.find({doctorId:doctorId});

        if(!result){
            console.log("doctor id not in the database");
            return res.status(200).json({message:"false"});
        }

        console.log("fetched successfully");
        return res.json({message : "success",result : result});

    }
    catch(error){
        console.log("Error in database",error);
        return res.status(500).json({message : "error in database"});
    }
};

exports.editFeedbackPanel = async (req, res) => {
    const { id } = req.params;      // document _id from params
    const doctorId = req.user._id;  // doctorId from logged-in user (auth)

    try {
        // Find document that matches both _id and doctorId
        const panel = await DoctorfeedbackSettings.findOneAndUpdate(
            { _id: new mongoose.Types.ObjectId(id), doctorId: doctorId },
            [{ $set: { isAvailable: { $not: "$isAvailable" } } }], // toggle
            { new: true } // return updated doc
        );

        if (!panel) {
            return res.status(404).json({ message: "Panel not found or unauthorized" });
        }

        return res.status(200).json({
            message: "Availability toggled successfully",
            data: panel
        });
    } catch (error) {
        console.error("Error toggling availability:", error.message);
        return res.status(500).json({ message: "Error updating availability" });
    }
};

// feedback panel questions

exports.generateDoctorFeedbackQuestions = async (req,res)=>{

    const {messengerUsecase,purpose,totalQuestions} = req.body;

    const response = await generateFeedbackQuestions(messengerUsecase,purpose,totalQuestions,0,0);
    console.log("ouput from grok  : ",response);

    res.json({output : response});
}


exports.createDoctorFeedback = async (req,res) => {

    
    // call that gork api and save questions in this area
    const doctorId = req.user._id;

    const {messengerUsecase,purpose,totalQuestions,afterXhours,feedbackName,questionsinput} = req.body;

    const questions = questionsinput;
    const questionsName = feedbackName;

    const output = await DoctorfeedbackSettings.findOne({doctorId : doctorId , msgUseCase : messengerUsecase});

    const queryId = output._id;

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

exports.viewFeedbackQuestionsofParticularQuery = async (req, res) => {
    const doctorId = req.user._id;
    const { id } = req.params; //  extract the property properly

    try {
        const output = await DoctorQuestionMapWithQuery.findOne({
            doctorId: doctorId,
            queryId : new mongoose.Types.ObjectId(id) 
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

exports.regenerateParticularQuestion = async (req,res) =>{
    //
    // const doctorId = req.user._id;
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

        return res.json({
            message: "Question updated successfully",
            regeneratedQuestions : newQuestion
        });


    }
    catch(error){
        console.log("error in database insertion ");
        return res.status(500).json({message: "error in database insertion"});
    }
}


// operational hours

exports.createClinicOperationalHours = async (req,res)=>{
    const {day, startingTime, endingTime} = req.body;

    try{
        await ClinicOperationHours.create({day : day ,startingTime : startingTime,endingTime : endingTime,createdAt : Date.now() });
        console.log("intially inserted successfully ");
        return res.json({message : "initially inserted successfully"});
    }
    catch(error){
        console.log("error in database insertion  ",error);
        return res.status(500).json({message : "error in data insertion in collection "});
    }

}
exports.getClinicOperationalHours = async (req,res)=>{
    
    try{
        const result = await ClinicOperationHours.find();
        if(!result){
            console.log("doctor id not present in database");
            return res.json({message : "doctorid not present in database"});
        }

        console.log("successfully fetched");
        return res.status(200).json({message : "success",result : result});
    }
    catch(error){
        console.log("error in fetching");
        return res.status(500).json({message : "error in fetching"});
    }
}
// const { ClinicOperationHours } = require("../models/DoctorAppointmentSettings");

exports.editOperationalHours = async (req,res)=>{
    const { id } = req.params;      // document _id from params 
    const {startingTime,endingTime,status} = req.body;

    try {
        // Find document that matches both _id and doctorId
        const panel = await ClinicOperationHours.findOneAndUpdate(
            { _id: new mongoose.Types.ObjectId(id)},
            [{ $set: { status :status, startingTime:startingTime, endingTime:endingTime }}], // toggle
            { new: true } // return updated doc
        );

        if (!panel) {
            return res.status(404).json({ message: "Panel not found or unauthorized" });
        }

        return res.status(200).json({
            message: "Availability toggled successfully",
            data: panel
        });
    } catch (error) {
        console.error("Error toggling availability:", error.message);
        return res.status(500).json({ message: "Error updating availability" });
    }
};

// appointment slottypes

exports.createAppointmentSlotTypes = async (req,res)=>{
    const {slotType,startingTime,endingTime,price,allowBooking} = req.body;

    try{
        const data = {
            slotType : slotType,
            startingTime : startingTime,
            endingTime : endingTime,
            price : price,
            allowBooking : allowBooking,
            createdAt : new Date()
        };
        await AppointmentSlotTypes.create(data);
        console.log("intial appointment slottypes created");
        return res.status(201).json({message : "initial appointment slottypes created"});
    }
    catch(error){
        console.log("error in database",error);
        return res.status(500).json({message : "error in database"});
    }
};

exports.getAppointmentSlottypes = async (req,res)=>{
    try{
        const result = await AppointmentSlotTypes.find({});

        console.log("successfully fetched");
        return res.status(200).json({message : "success",result : result});
    }
    catch(error){
        console.log("error in fetching ");
        return res.status(500).json({message : "error in fetching"});
    }
}


exports.updateSlotType = async (req, res) => {
    const {id} = req.params;
    const {startingTime,endingTime ,price,allowBooking} = req.body;
    try {
        const result = await AppointmentSlotTypes.findOneAndUpdate(
            {_id : new mongoose.Types.ObjectId(id)},
            [{$set : {startingTime:startingTime,endingTime : endingTime,price:price,allowBooking:allowBooking}}],
            {new : true}
        );
        if (!result) {
            return res.status(404).json({ message: "id not foound" });
        }

        return res.status(200).json({
            message: "updated successfully",
            data: result
        });

    } catch (error) {
        console.error("Error updating slot type:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.deleteSlotTypes = async (req,res)=>{

    try {
        const { id } = req.params; // the document _id from URL params

        // Convert string id to ObjectId
        const objectId = new mongoose.Types.ObjectId(id);

        const deletedDoc = await AppointmentSlotTypes.findByIdAndDelete(objectId);

        if (!deletedDoc) {
            return res.status(404).json({ message: "Document not found" });
        }

        return res.json({ message: "Document deleted successfully" });
    } 
    catch (error) {
        console.error("Error deleting document:", error);
        return res.status(500).json({ message: "Error deleting document" });
    }
};

// consultation priority 

exports.createConsulationPriorityMapping = async(req,res)=>{
    const {priority,percentage} = req.body;
    try{
        await ConsultationPriorityMapping.create({priority:priority, percentage : percentage,createdAt : Date.now()});
        console.log("data inserted successfully");
        return res.status(201).json({message:"data inserted successfully "});
    }
    catch(error){
        console.log("error in creation ");
        return res.status(500).json({message : "error in database insertion "})
    }
};

exports.editConsultationPriorityMapping = async (req, res) => {
    const { percentage } = req.body;
    const {id} = req.params;

    try {
        // Find current document
        const data = await ConsultationPriorityMapping.findOneAndUpdate(
            {_id : new mongoose.Types.ObjectId(id)},
            [{$set : {percentage : percentage}}],
            {new : true}
        );
        
        if (!data) {
            return res.status(404).json({ message: "id not foound" });
        };

        return res.status(200).json({ message: 'modified successfully', data });
    } 
    catch (error) {
        console.log("Error in database operations", error);
        return res.status(500).json({ message: "error in database operations" });
    }
};


exports.getConsultationPriorityMapping = async (req,res) =>{
    try{
        const result = await ConsultationPriorityMapping.find({});
        if(!result){
            console.log("doctor id not present in database");
            return res.json({message : "doctorid not present in database"});
        }

        console.log("successfully fetched");
        return res.status(200).json({message : "success",result : result});
    }
    catch(error){
        console.log("error in the database fetching ");
        return res.status(500).json({message : "error in the database fetching"});
    }
};

// reschedule and refund 

exports.createRescheduleAndRefund = async (req,res)=>{
    const {name} = req.body;
    try{
        const result = await RescheduleAndRefund.create({name : name});
        if(!result){
            console.log("error data not inserted");
            return res.status(400).json({message : "error data not inserted"});
        }
        console.log("created ");
        return res.status(201).json({message : "created"});
    }
    catch(error){
        console.log("database error");
        return res.status(500).json({message:"database error"});
    }
}

exports.editRescheduleAndRefund = async (req,res)=>{
    const {id} = req.params;
    try{
        const result = await RescheduleAndRefund.findOneAndUpdate(
            {_id : new mongoose.Types.ObjectId(id)},
            [{$set : {status : {$not : "$status"}}}],
            
        );
        if (!result) {
            return res.status(404).json({ message: "id not foound" });
        };

        return res.status(200).json({ message: 'modified successfully', result });

    }
    catch(error){
        console.log("database error");
        return res.status(500).json({message:"database error"});
    }
};

exports.getRescheduleAndRefund = async (req,res)=>{
    try{
        const result = await RescheduleAndRefund.find({});
        if (!result) {
            return res.status(404).json({ message: "id not foound" });
        };

        console.log("fetched successfully");
        return res.json({message : "success" , result : result });

    }
    catch(error){
        console.log("database error");
        return res.status(500).json({message:"database error"});
    }
};

// create 

exports.createShipmentPanel = async (req,res)=>{
    try{

        await ShipmentPanelSettings.create({createdAt: Date.now()});
        console.log("intial table created");
        return res.status(201).json({message :"intial table created "});
        
    }
    catch(error){
        console.log("database error");
        return res.status(500).json({message:"database error"});
    }
}

// Get current shipment panel settings
exports.getShipmentPanel = async (req, res) => {
  try {
    const panel = await ShipmentPanelSettings.find();
    if (!panel) {
      return res.status(404).json({ message: "Shipment Panel settings not found" });
    }
    res.json(panel);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update shipment panel settings (toggles true/false)
exports.updateShipmentPanel = async (req, res) => {
  try {
    const {updates} = req.body; // { enableImageUpload: true, allowTextInstructions: false, ... }
    
    let panel = await ShipmentPanelSettings.findOne();
    if (!panel) {
      panel = new ShipmentPanelSettings(updates);
    } else {
      Object.assign(panel, updates); // merge updates
    }

    await panel.save();
    res.json(panel);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Payment intimation panel

exports.createPaymentIntimationPanel = async (req,res)=>{
    try{
        await PaymentIntimationPanel.create({createdAt : Date.now()});
        console.log("inital payment intimation panel created");
        return res.status(201).json({message : "inital payment intimation panel created"});
    }
    catch(error){
        console.log("Error in database");
        return res.status(500).json({message : "error in database"});
    }
};

exports.editPaymentIntimationPanel = async(req,res)=>{
    const {str} = req.body;
    const id = req.params.id;

    try{
        const data = await PaymentIntimationPanel.findById(id);

        if(!data){
            console.log(`this ${id}document is not available in database`);
            return res.json({message : `this ${id}document is not available in database`});
        }

        if(str === "enablePaymentIntimation"){
            data.enablePaymentIntimation =  !data.enablePaymentIntimation;
        }
        else if(str === "enableFollowUps"){
            data.enableFollowUps = !data.enableFollowUps;
        }
        else if(str === "enableChargeSummaryPreview"){
            data.enableChargeSummaryPreview.isAvailable = !data.enableChargeSummaryPreview.isAvailable;
        }
        else{
            console.log("input is invalid");
            return res.status(400).json({message : "Invalid input ",input : str});
        }

        await data.save();

        console.log("modified successfully ");
        return res.status(200).json({message : "modified successfully"});

    }
    catch(error){
        console.log("eror in database operations");
        return res.status(500).json({message : "error  in the database operations "});
    }
}



