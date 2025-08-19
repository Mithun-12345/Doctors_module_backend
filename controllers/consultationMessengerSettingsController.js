
const { default: mongoose } = require("mongoose");
const {generateFeedbackQuestions,regenerateSingleQuestion} = require("./grokFunction");
const {DoctorQuestionMapWithQuery,DoctorfeedbackSettings,ClinicOperationHours,AppointmentSlotTypes,ConsultationPriorityMapping,ShipmentPanelSettings,PaymentIntimationPanel} = require("../models/consultationMessengerSettings");

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

exports.createDoctorFeedback = async (req,res) => {

    
    // call that gork api and save questions in this area
    const doctorId = req.user._id;

    const {messengerUsecase,purpose,totalQuestions,afterXhours} = req.body;

    const response = await generateFeedbackQuestions(messengerUsecase,purpose,totalQuestions,0,0);
    console.log("ouput from grok  : ",response);
    const questions = response.questions;
    const questionsName = response.feedbackName;

    const output = await DoctorfeedbackSettings.findOne({doctorId : doctorId , msgUseCase : messengerUsecase});

    // const generalQueryId = output.generalQuery._id;
    // const newConsultationId = output.newConsultation._id;
    // const existingConsultationId = output.existingConsultation._id;
    // const opinionConsultationId = output.opinionConsultation._id;

    // let queryId;
    // // find the true query 0    
    // if(messengerUsecase == "generalQuery"){
    //     queryId = generalQueryId;
    // }
    // else if(messengerUsecase == "newConsultation"){
    //     queryId = newConsultationId;
    // }
    // else if(messengerUsecase == "opinionConsultation"){
    //     queryId = opinionConsultationId;
    // }
    // else if(messengerUsecase == "existingConsultation"){
    //     queryId = existingConsultationId;
    // }
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


exports.createClinicOperationalHours = async (req,res)=>{
    const doctorId = req.user._id;

    try{

        const result = await ClinicOperationHours.findOne({doctorId : doctorId});
        
        if(!result){
            await ClinicOperationHours.create({doctorId:doctorId,createdAt : Date.now() });
            console.log("intially inserted successfully ");
            return res.json({message : "initially inserted successfully"});
        }

        console.log("already data  inserted ",result);
        return res.status(201).json({message : " already data inserted successfully"});
    }
    catch(error){
        console.log("error in database insertion  ",error);
        return res.status(500).json({message : "error in data insertion in collection "});
    }

}
exports.getClinicOperationalHours = async (req,res)=>{
    const doctorId = req.user._id;
    try{
        const result = await ClinicOperationHours.findOne({doctorId : doctorId});
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

exports.updateClinicOperationalHours = async (req, res) => {
    const doctorId = req.user._id;
    try {
        const { day, day_id, startTime, endTime } = req.body;

        if (!doctorId || !day || !day_id || !startTime || !endTime) {
            return res.status(400).json({
                message: "doctorId, day, day_id, startTime, and endTime are required"
            });
        }

        // Validate day name
        const validDays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        if (!validDays.includes(day.toLowerCase())) {
            return res.status(400).json({ message: "Invalid day name" });
        }

        // Find the doctor's schedule
        const doc = await ClinicOperationHours.findOne({ doctorId });
        if (!doc) {
            return res.status(404).json({ message: "Doctor schedule not found" });
        }

        // Get the specific day object
        const dayData = doc[day.toLowerCase()];
        if (!dayData || dayData._id.toString() !== day_id) {
            return res.status(404).json({ message: "Day record not found" });
        }

        // Update start and end times
        dayData.startTime = startTime;
        dayData.endTime = endTime;

        // Toggle isAvailable
        dayData.isAvailable = !dayData.isAvailable;

        // Update timestamp
        doc.updatedAt = new Date.now();

        await doc.save();

        return res.json({
            message: `${day} working hours updated & availability toggled successfully`,
            updatedDoc: doc
        });

    } catch (error) {
        console.error("Error updating working hours:", error);
        return res.status(500).json({
            message: "Server error while updating working hours"
        });
    }
};

exports.createAppointmentSlotTypes = async (req,res)=>{
    const doctorId = req.user._id;

    try{
        const result = await AppointmentSlotTypes.findOne({doctorId : doctorId});
        if(!result){
            await AppointmentSlotTypes.create({doctorId : doctorId , createdAt : Date.now()});
            console.log("intial appointment slottypes created");
            return res.status(201).json({message : "initial appointment slottypes created"});
        }

        console.log("initial appointment already created");
        return res.status(400).json({message:"initial appointment already created"});
    }
    catch(error){
        console.log("error in database");
        return res.status(500).json({message : "error in database"});
    }
};

exports.getAppointmentSlottypes = async (req,res)=>{
    const doctorId = req.user._id;
    try{
        const result = await AppointmentSlotTypes.findOne({doctorId : doctorId});
        if(!result){
            console.log("doctor id not present in database");
            return res.json({message : "doctorid not present in database"});
        }

        console.log("successfully fetched");
        return res.status(200).json({message : "success",result : result});
    }
    catch(error){
        console.log("error in fetching ");
        return res.status(500).json({message : "error in fetching"});
    }
}


exports.updateSlotType = async (req, res) => {
    try {
        const { type, startTime, endTime, price, days } = req.body;

        const doctorId = req.user._id;

        if (!doctorId || !type || !startTime || !endTime || price === undefined) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Fetch current doc
        const doc = await AppointmentSlotTypes.findOne({ doctorId: doctorId });

        if (!doc) {
            return res.status(404).json({ message: "Doctor slot settings not found" });
        }

        // Check if type exists in doc
        if (!doc[type]) {
            return res.status(400).json({ message: `Invalid type: ${type}` });
        }

        // Toggle isAvailable
        const currentAvailability = doc[type].isAvailable;
        const updatedAvailability = !currentAvailability;

        // Base update data
        const updateData = {
            [`${type}.startTime`]: startTime,
            [`${type}.endTime`]: endTime,
            [`${type}.price`]: price,
            [`${type}.isAvailable`]: updatedAvailability,
            updatedAt: new Date()
        };

        // If type is "Weekend", also update days array
        if (type === "Weekend") {
            if (!Array.isArray(days)) {
                return res.status(400).json({ message: "For Weekend type, 'days' must be an array of strings" });
            }
            updateData[`${type}.days`] = days;
        }

        // Update using updateOne
        await AppointmentSlotTypes.updateOne(
            { doctorId: doctorId },
            { $set: updateData }
        );

        return res.json({
            message: `${type} slot updated successfully`,
            updatedFields: updateData
        });

    } catch (error) {
        console.error("Error updating slot type:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.deleteSlotTypes = async (req,res)=>{
    const doctorId = req.user._id;

    try {
        const {type } = req.body; // or req.query

        if (!doctorId || !type) {
            return res.status(400).json({ message: "doctorId and type are required" });
        }

        const allowedTypes = ["Normal", "PostWorkingHours", "Weekend", "OpinionConsultation"];
        if (!allowedTypes.includes(type)) {
            return res.status(400).json({ message: "Invalid type provided" });
        }

        const result = await AppointmentSlotTypes.updateOne(
            { doctorId: doctorId },
            { $unset: { [type]: "" } } // remove the field
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: "No matching document or type found" });
        }

        res.json({ message: `${type} slot deleted successfully` });
    } 
    catch (error) {
        console.error("Error deleting slot type:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.createConsulationPriorityMapping = async(req,res)=>{
    try{
        await ConsultationPriorityMapping.create({createdAt : Date.now()});
        console.log("data inserted successfully");
        return res.status(201).json({message:"data inserted successfully "});
    }
    catch(error){
        console.log("error in creation ");
        return res.status(500).json({message : "error in database insertion "})
    }
};

exports.editConsultationPriorityMapping = async (req, res) => {
    const { str } = req.body;
    const id = req.params.id;

    try {
        // Find current document
        const data = await ConsultationPriorityMapping.findById(id);
        if (!data) {
            return res.status(404).json({ message: 'Document not found' });
        }

        if (str === "AllowRescheduling") {
            data.AllowRescheduling = !data.AllowRescheduling;
        } else if (str === "RefundAdjustmentOnRescheduling") {
            data.RefundAdjustmentOnRescheduling = !data.RefundAdjustmentOnRescheduling;
        } else {
            return res.status(400).json({ message: 'Invalid field option' });
        }

        await data.save();

        return res.status(200).json({ message: 'modified successfully', data });
    } catch (error) {
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



