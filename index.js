const express=require('express')
const app=express()
const cors=require('cors')
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
const run=async()=>{
    try{
    await  client.connect();
    const servicesCollection=client.db('doctors_portal').collection('services');

    app.get('/service',async(req,res)=>{
      const query={}
      const cursor=servicesCollection.find(query);
      const services=await cursor.toArray()
      res.send(services)
    })
   

    }finally{

    }
}
run().catch(console.dir)


app.listen(port,()=>console.log("Started Successfully"))