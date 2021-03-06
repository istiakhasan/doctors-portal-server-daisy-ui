const express=require('express')
const app=express()
const cors=require('cors');
const jwt=require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
var nodemailer = require('nodemailer');
var sendinBlue = require('nodemailer-sendinblue-transport');

app.use(cors())
require('dotenv').config()
const stripe=require('stripe')(process.env.STRIPE_SECRET_KEY)
app.use(express.json())
const port=process.env.PORT || 4000
app.get('/',(req,res)=>{
    res.send("Doctor portal started successfully")
})


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0lsn7.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: 'UnAuthorized access' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
   
    if (err) {
      return res.status(403).send({ message: 'Forbidden access' })
    }
    req.decoded = decoded;
    next();
  });
}

const run=async()=>{
    try{
    await  client.connect();
    const servicesCollection=client.db('doctors_portal').collection('services');
    const bookingCollection=client.db('doctors_portal').collection('bookings');
    const userCollection=client.db('doctors_portal').collection('users');
    const doctorsCollection=client.db('doctors_portal').collection('doctors');
    const paymentCollection=client.db('doctors_portal').collection('payments');



    const verifyAdmin=async(req,res,next)=>{
      const requester=req.decoded.email
      const requesterAccount=await userCollection.findOne({email:requester});
      if(requesterAccount.role==='admin'){
      next()
      }else{
        res.status(403).send({message:'forbidden'})
      }
    }
//payments=====================================
// app.post('/create-payment-intent',verifyJWT, async(req,res)=>{
//   const service=req.body 
//   const price=service.price 
//   const amount=price*100; 
//   const paymentIntent=await stripe.paymentIntents.create({
//     amount:amount,
//     currency:'usd',
//     payment_method_types:['card']
//   })
//   res.send({clientSecret:paymentIntent.client_secret})
// })
app.post('/create-payment-intent', verifyJWT, async(req, res) =>{
  const service = req.body;
  const price = service.price;
  const amount = price*100;
  const paymentIntent = await stripe.paymentIntents.create({
    amount : amount,
    currency: 'usd',
    payment_method_types:['card']
  });
  res.send({clientSecret: paymentIntent.client_secret})
});

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
  app.put('/user/admin/:email',verifyJWT,verifyAdmin,async(req,res)=>{
      const email=req.params.email
      const filter={email:email};
      const updateDoc={
        $set:{role:'admin'}
      };
      const result=await userCollection.updateOne(filter,updateDoc);
      res.send(result)
  
 
  })
  app.put('/user/:email', async (req, res) => {
    const email = req.params.email;
    const user = req.body;
    const filter = { email: email };
    const options = { upsert: true };
    const updateDoc = {
      $set: user,
    };
    const result = await userCollection.updateOne(filter, updateDoc, options);
    const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
    res.send({ result, token });
  });

    // app.put('/user/:email',async(req,res)=>{
    //  const email=req.params.email;
    
    //  const user=req.body;
    //  const filter={email: email};
    //  const options={upsert:true}
    //  const updateDoc={
    //    $set:user
    //  }
    //  const result=await userCollection.updateOne(filter,updateDoc,options);
    //  const token=jwt.sign({email:email},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'})
    //  res.send({result,token})

    // });
  // api naming convention
  //app.get('/booking')//get all bookings in this collection or get more than one or by filter
  //app.get('/booking/:id)//get a specific booking
  //app.post('/booking)//add a new booking 
  //app.patch('/booking/:id') //
  //app.delete('/booking/:id')//
    app.get('/service',async(req,res)=>{
      const query={}
      const cursor=servicesCollection.find(query).project({name:1});
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


    app.get('/booking/:id',verifyJWT,async(req,res)=>{
      const id=req.params.id 
      const query={_id:ObjectId(id)}
      const booking=await bookingCollection.findOne(query) 
      res.send(booking)
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


    // payment booking 
    app.patch('/booking/:id',verifyJWT,async(req,res)=>{
      const id=req.params.id 
      const payment=req.body
      console.log(payment,"transaction id")
      const filter={_id:ObjectId(id)}
      const updateDoc={
        $set:{
          paid:true,
          transactionId:payment.transactionId
        }
      }
      const updatedBooking=await bookingCollection.updateOne(filter,updateDoc);
      const result=await paymentCollection.insertOne(payment)
      res.send(updateDoc)
    })

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



    app.post('/doctor',verifyJWT,verifyAdmin,async(req,res)=>{
       const doctor=req.body 
      
       const result=await doctorsCollection.insertOne(doctor)
       res.send(result)
    })
    app.delete('/doctor/:email',verifyJWT,verifyAdmin,async(req,res)=>{
       const email=req.params.email;
       const filter={email:email}
       const result=await doctorsCollection.deleteOne(filter)
       res.send(result)
    })
    app.get('/doctor',verifyJWT,verifyAdmin,async(req,res)=>{
    const doctors=await doctorsCollection.find().toArray()
    res.send(doctors)
    })
  
   

    }finally{

    }
}
run().catch(console.dir)


app.listen(port,()=>console.log("Started Successfully"))