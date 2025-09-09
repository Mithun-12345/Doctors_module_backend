
const { default: mongoose } = require("mongoose");
const {generateFeedbackQuestions,regenerateSingleQuestion} = require("./grokFunction");
const {PaymentIntimationPanelEnableSchema,  PaymentIntimationPanelSchema2,PaymentMsgTempSchema,RescheduleAndRefund,DoctorQuestionMapWithQuery,DoctorfeedbackSettings,ClinicOperationHours,AppointmentSlotTypes,ConsultationPriorityMapping,ShipmentPanel} = require("../models/consultationMessengerSettings");
const { read } = require("pdfkit");
const patientModel = require("../models/patientModel");
const Message = require('../models/messageModel'); // Or whatever the path to your file is

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

exports.createDoctorFeedback = async (req, res) => {
    const doctorId = req.user._id;

    // Destructuring to match the frontend payload
    const { messengerUsecase, purpose, totalQuestions, afterXhours, feedbackName, questions } = req.body;

    // A quick validation to ensure questions are provided
    if (!questions || !Array.isArray(questions)) {
        return res.status(400).json({ message: "The 'questions' field must be an array and is required." });
    }

    try {
        // Find the related settings document
        const output = await DoctorfeedbackSettings.findOne({ doctorId: doctorId, msgUseCase: messengerUsecase });

        // --- FIX: Add a null check ---
        if (!output) {
            return res.status(404).json({ message: "Feedback settings not found for this doctor and use case." });
        }

        const queryId = output._id;

        const dataToInsert = {
            doctorId,
            queryId,
            messengerUsecase,
            afterXhours,
            purpose,
            totalQuestions,
            questionsName: feedbackName, // Using feedbackName directly
            questions, // Using the destructured 'questions'
            createdAt: new Date()
        };

        // --- FIX: Use the correct Mongoose 'create' method ---
        const result = await DoctorQuestionMapWithQuery.create(dataToInsert);

        console.log("Successfully inserted");
        return res.status(201).json({ message: "Inserted successfully", result: result });

    } catch (error) {
        console.log("Error in creating doctor feedback: ", error);
        return res.status(500).json({ message: "An error occurred while saving the feedback.", error: error.message });
    }
};

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
};

exports.ViewAllTheTypesOfQuery = async (req,res)=>{
    try{
        const result = await DoctorfeedbackSettings.find();
        const filteredData = result.map(item => ({
            _id: item._id,
            msgUseCase: item.msgUseCase
          }));
        console.log("data fetched from the docter query settings");
        return res.status(200).json({success : true,message : "data fetched from the doctor query settings",filteredData});
    }
    catch(error){
        console.log("error in the data fetching..");
        return res.status(500).json({success : false,message : error});
    }
};

exports.displayTheCreatedQuestionsForTheQuery = async (req, res) => {
    // 1. Get the ID from the URL (works for any user)
    const queryId = req.params.id;

    try {
        // 2. Find the settings document using the ID from the URL
        const settingsDoc = await DoctorfeedbackSettings.findOne({ _id: queryId });

        if (!settingsDoc) {
            return res.status(404).json({ success: false, message: "This feedback query was not found." });
        }
        if (!settingsDoc.isAvailable) {
            return res.status(400).json({ success: false, message: "This feedback type is not currently available." });
        }

        // 3. The key! Extract the doctor's ID FROM the settings document
        const doctorId = settingsDoc.doctorId;

        // 4. Use both IDs to find the exact questions needed
        const result = await DoctorQuestionMapWithQuery.find({
            queryId: queryId,
            doctorId: doctorId
        }).sort({ createdAt: -1 });

        if (result.length === 0) {
            return res.status(200).json({ success: true, message: "No questions found for this query.", result: [] });
        }

        // Return the most recent questions
        return res.status(200).json({ success: true, message: "Successfully fetched", result: result[0] });

    } catch (error) {
        console.log("Error during data fetching:", error);
        return res.status(500).json({ success: false, message: "An internal server error occurred." });
    }
};


exports.updateReadOptionForTheQuestions = async (req, res) => {
    const { isRead } = req.body;
    const documentId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
        return res.status(400).json({ success: false, message: "Invalid ID format" });
    }

    try {
        // ✅ STEP 2: Use the imported 'Message' model here
        const updatedDocument = await Message.findByIdAndUpdate(
            documentId,
            { $set: { isRead: isRead } },
            { new: true } // This option returns the updated document
        );

        if (!updatedDocument) {
            return res.status(404).json({ success: false, message: "No document found with this ID" });
        }

        return res.status(200).json({
            success: true,
            message: "Update successful",
            data: updatedDocument
        });

    } catch (error) {
        console.log("Error during database update:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
exports.updateIsBotOptionForThePatient = async (req, res) => {
    // 1. Get patientId and isBotActive from the request body
    const { patientId, isBotActive } = req.body;

    // 2. Validate the incoming payload
    if (!patientId || typeof isBotActive !== 'boolean') {
        return res.status(400).json({
            success: false,
            message: "Payload must include 'patientId' (string) and 'isBotActive' (boolean)."
        });
    }

    // Optional but recommended: Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
        return res.status(400).json({ success: false, message: "Invalid patientId format." });
    }

    try {
        // 3. Find the patient by their ID and update the isBotActive field
        const updatedPatient = await patientModel.findByIdAndUpdate(
            patientId,
            { $set: { isBotActive: isBotActive } },
            { new: true } // Returns the updated document instead of the old one
        );

        // 4. Check if a patient was found and updated
        if (!updatedPatient) {
            return res.status(404).json({ success: false, message: "Patient not found with the provided ID." });
        }

        // 5. Send a successful response
        return res.status(200).json({
            success: true,
            message: "Bot activation status updated successfully.",
            patient: updatedPatient
        });

    } catch (error) {
        console.error("Error updating bot status:", error);
        // Return a generic server error message
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};


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





exports.sendShipmentPanel = async (req, res) => {
  try {
    const defaults = [
      { name: "Enable Image Upload", status: true },
      { name: "Allow Text Instructions", status: true },
      { name: "Enable Mark As Received", status: true },
      { name: "Customer Acknowledgement", status: true },
      { name: "Mark As Lost In Transit", status: true },
    ];

    // Insert only if collection is empty
    const existing = await ShipmentPanel.find();
    if (existing.length === 0) {
      await ShipmentPanel.insertMany(defaults);
      return res.json({ message: "Default shipment panels inserted " });
    } else {
      return res.json({ message: "Already seeded" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.getShipmentPanels = async (req, res) => {
  try {
    const panels = await ShipmentPanel.find();
    res.json(panels);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH: update only status by ID
exports.updateShipmentPanel = async (req, res) => {

   try {
    const id = req.params.id;

    // Find the document first
    let shipment = await ShipmentPanel.findById(id);

    if (!shipment) {
      return res.status(404).json({ message: "Record not found" });
    }

    // Toggle the boolean
    shipment.status = !shipment.status;

    // Save the updated document
    await shipment.save();

    res.json({
      message: "Status toggled successfully",
      data: shipment
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Payment intimation panel 

exports.createPaymentSettings1 = async (req, res) => {
    try {
      const defaults = [
        { name: "enablePaymentIntimation", status: true },
        { name: "enableFollowups", status: true },
        { name: "enablechargeSummaryPreview", status: true },
        
      ];
  
      // Insert only if collection is empty
      const existing = await PaymentIntimationPanelEnableSchema.find();
      if (existing.length === 0) {
        await PaymentIntimationPanelEnableSchema.insertMany(defaults);
        return res.json({ message: "Default inserted " });
      } else {
        return res.json({ message: "Already seeded" });
      }
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };
  
exports.createPaymentSettings2 = async (req, res) => {
  
   try {
      const defaults = [
        { Interval: 2, Followupmsgtemp: "Gentle reminder: Your payment is pending" },
      ];
  
      // Insert only if collection is empty
      const existing = await PaymentIntimationPanelSchema2.find();
      if (existing.length === 0) {
        await PaymentIntimationPanelSchema2.create(defaults);
        return res.json({ message: "Default inserted " });
      } else {
        return res.json({ message: "Already seeded" });
      }
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };
  

  


exports.getPaymentIntimationPanel1 = async (req,res)=>{
    try{
        const result = await PaymentIntimationPanelEnableSchema.find({});
        if(!result){
            console.log("no documnet found");
            return res.status(400).json({message : "no document found"});
        }
        console.log("fetched successfully");
        return res.json({success : true , result : result});
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
      }
};

exports.updatePaymentIntimationPanel1 = async (req, res) => {

    try {
     const id = req.params.id;
 
     // Find the document first
     let Payment = await PaymentIntimationPanelEnableSchema.findById(id);
 
     if (!Payment) {
       return res.status(404).json({ message: "Record not found" });
     }
 
     // Toggle the boolean
     Payment.status = !Payment.status;
 
     // Save the updated document
     await Payment.save();
 
     res.json({
       message: "Status toggled successfully",
       data: Payment
     });
   } catch (err) {
     console.error(err);
     res.status(500).json({ message: "Server error" , err});
   }
 };

exports.getPaymentIntimationPanel2 = async (req,res)=>{
    try{
        const result = await PaymentIntimationPanelSchema2.find({});
        if(!result){
            console.log("no documnet found");
            return res.status(400).json({message : "no document found"});
        }
        console.log("fetched successfully");
        return res.json({success : true , result : result});
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
      }
};

exports.editPaymentIntimationPanel2 = async(req,res)=>{
    const {id} = req.params;
    const {Interval,Followupmsgtemp} = req.body;
    try{
        const result = await PaymentIntimationPanelSchema2.findOneAndUpdate(
            {_id: new mongoose.Types.ObjectId(id)},
            [{$set : {Interval : Interval , Followupmsgtemp: Followupmsgtemp}}],
            {new : true}
        );

        if (!result) {
            return res.status(404).json({ message: "id not foound" });
        };

        return res.status(200).json({ message: 'modified successfully', result });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
      }
}

// payment msg template

exports.createPaymentSettings3 = async (req, res) => {
  
    try {
        const defaults = [
          { Description: "Hello! Your total bill is ₹{total_amount}. Please click below to pay and confirm your order.", Placeholder: ["{medicine_amount}", "{shipment_amount}", "{total_amount}"] },
        ];
    
        // Insert only if collection is empty
        const existing = await PaymentMsgTempSchema.find();
        if (existing.length === 0) {
          await PaymentMsgTempSchema.create(defaults);
          return res.json({ message: "Default inserted " });
        } else {
          return res.json({ message: "Already seeded" });
        }
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    };

exports.editPaymentMsgTemplate = async (req,res)=>{
    const {id} = req.params;
    const {Description,Placeholder} = req.body;
    try{
        const result = await PaymentMsgTempSchema.findOneAndUpdate(
            {_id: new mongoose.Types.ObjectId(id)},
            [{$set : {Description : Description , Placeholder: Placeholder}}],
            {new : true}
        );

        if (!result) {
            return res.status(404).json({ message: "id not foound" });
        };

        return res.status(200).json({ message: 'modified successfully', result });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
      }
    
};

exports.getPaymentMsgTemplate = async (req,res)=>{
    try{
        const result = await PaymentMsgTempSchema.find({});
        if(!result){
            console.log("no documnet found");
            return res.status(400).json({message : "no document found"});
        }
        console.log("fetched successfully");
        return res.json({success : true , result : result});
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
      }
};