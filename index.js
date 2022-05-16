const express=require('express')
const app=express()
const cors=require('cors');
const jwt=require('jsonwebtoken')
const { MongoClient, ServerApiVersion } = require('mongodb');
app.use(cors())
require('dotenv').config()
app.use(express.json())
const port=process.env.PORT || 4000
app.get('/',(req,res)=>{
    res.send("Doctor portal started successfully")
})


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0lsn7.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
function verifyJWT(req,res,next){
   const authHeader=req.headers.authorization;
   if(!authHeader){
     return res.status(401).send({message:'unauthorized access'})
   }
   const token=authHeader.split(' ')[1];
   jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
     if(err){
       return res.status(403).send({message:"Forbidden access"})
     }
     req.decoded=decoded
    
     next()
   })

}

const run=async()=>{
    try{
    await  client.connect();
    const servicesCollection=client.db('doctors_portal').collection('services');
    const bookingCollection=client.db('doctors_portal').collection('bookings');
    const userCollection=client.db('doctors_portal').collection('users');


  app.get('/admin/:email',async(req,res)=>{
    const email=req.params.email
    const user=await userCollection.findOne({email:email});
    const isAdmin=user.role==='admin'
    res.send({admin:isAdmin})
  })  
   
  app.get('/user',verifyJWT,async(req,res)=>{
    const users=await userCollection.find().toArray()
    res.send(users)
  });
  app.put('/user/admin/:email',verifyJWT,async(req,res)=>{
    const email=req.params.email
    const requester=req.decoded.email
    const requesterAccount=await userCollection.findOne({email:requester});
    if(requesterAccount.role=== 'admin'){
      const filter={email:email};
      const updateDoc={
        $set:{role:'admin'}
      };
      const result=await userCollection.updateOne(filter,updateDoc);
      res.send(result)
    }else{
      res.status(403).send({message:'forbidden'})
    }
 
  })

    app.put('/user/:email',async(req,res)=>{
     const email=req.params.email;
    
     const user=req.body;
     const filter={email: email};
     const options={upsert:true}
     const updateDoc={
       $set:user
     }
     const result=await userCollection.updateOne(filter,updateDoc,options);
     const token=jwt.sign({email:email},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'})
     res.send({result,token})

    });
  // api naming convention
  //app.get('/booking')//get all bookings in this collection or get more than one or by filter
  //app.get('/booking/:id)//get a specific booking
  //app.post('/booking)//add a new booking 
  //app.patch('/booking/:id') //
  //app.delete('/booking/:id')//
    app.get('/service',async(req,res)=>{
      const query={}
      const cursor=servicesCollection.find(query);
      const services=await cursor.toArray()
      res.send(services)
    });

    app.get('/booking',verifyJWT, async(req,res)=>{
      const patient=req.query.patient;
      const decodedEmail=req.decoded.email
     
      if(decodedEmail===patient){
        const query={patient:patient}
        const bookings=await bookingCollection.find(query).toArray();
       
        return  res.send(bookings)
      }else{
       return res.status(403).send({message:"Forbidded access"})
      }
    })

    app.post('/booking',async(req,res)=>{
      const booking=req.body 
      const query={treatment:booking.treatment,date:booking.date,patient:booking.patient}
     const exists=await bookingCollection.findOne(query);
     if(exists){
     return res.send({success:false,booking:exists})
     }else{

       const result=await bookingCollection.insertOne(booking)
       return res.send({success:true,result})
      }
    
    });

    app.get('/available',async(req,res)=>{
      const date=req.query.date || "May 14, 2022"
      //step 1:get all services 
      const services=await servicesCollection.find().toArray()
      //step 2:get the booking of that day 
      const query={date:date} 
      const bookings=await bookingCollection.find(query).toArray()
      //step 3 :for each service , find bookings for that service 
      services.forEach(service=>{
        const serviceBookings=bookings.filter(b=>b.treatment===service.name)
        // console.log(serviceBookings)
        // service.booked=serviceBookings.map(s=>s.slot)
        const booked=serviceBookings.map(s=>s.slot);
       
        const available=service.slots.filter(s=>!booked.includes(s))
        service.slots=available
        // service.available=available

      })
     
       res.send(services)
    });
   

    }finally{

    }
}
run().catch(console.dir)


app.listen(port,()=>console.log("Started Successfully"))