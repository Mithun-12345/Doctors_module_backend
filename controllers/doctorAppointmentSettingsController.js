
const DoctorAppointmentSettings = require("../models/DoctorAppointmentSettings");

exports.createAppointmentTimings = async (req,res)=>{
    const doctorId = req.user._id;

    const {sunday,monday,tuesday,wednesday,thursday,friday,saturday } = req.body;

    const data = {
        doctorId,
        sunday,
        monday,
        tuesday,
        wednesday,
        thursday,
        friday,
        saturday
    };

    try{
        const result = await DoctorAppointmentSettings.insertOne(data);
        
        if(!result){
            console.log("Not inserted");
            return res.json({message : "not inserted"});
        }

        console.log("data  inserted ",result);
        return res.status(201).json({message : "data inserted successfully"});
    }
    catch(error){
        console.log("error in database insertion  ",error);
        return res.status(500).json({message : "error in data insertion in collection "});
    }

}