
const {ClinicOperationHours,AppointmentSlotTypes,ConsultationPriorityMapping} = require("../models/DoctorAppointmentSettings");

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

