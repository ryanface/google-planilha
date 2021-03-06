/*
  Declaração de variáveis Globais.
*/
var mongodb = require('mongodb');
var configuration = require('../conf/configuration');
/*
  Classe com a implementação
*/
class oAPI{
    /*
       Inicialização do socket e abertura da conexão
    */    
    constructor(socket){
        this.db;
        this.databaseUrl;
        this.SOCKET = socket;
        this.open_mongodb();
    }
    /*
       Conexão com database
    */      
    async open_mongodb(callback=undefined,params=undefined){
      //npm uninstall mongodb --save
      //npm install mongodb@2.2.33 --save
        const MongoClient = require('mongodb').MongoClient;
        const url = 'mongodb://'+configuration.mongoConnection+'/'+configuration.mongoDB
        await MongoClient.connect(url, (err, client) =>{
            if(err){
                console.log("MongoDB Connected error:",err);
                this.SOCKET.emit("MongoDB", "err");
            }
            if(!err){
                console.log("MongoDB Session:"+this.SOCKET.id+" Connected successfully to server");
                /*
                   Salva o cliente
                */ 
                this.db = client;
                this.SOCKET.emit("MongoDB", "ok");
            }
        });
    }
    /*
       Fechamento da conexão com database
    */     
    closeConnection(){
       if(this.db != undefined){
          this.db.close();
          this.db = undefined;
          console.log("MongoDB Session:"+this.SOCKET.id+" Close");
      }
    }
    /*
       Consulta de dados simples 
    */     
    query(collection,find,limit){
       this.db.collection(collection).find(find).limit(limit).skip(1,
          function(err,docs){
            if(!err){
               return docs;
            }else console.log(err);
          }
       );
    }
    /*
       Persistência de dados simples
    */     
    save(data){
      let fields = data[0];
      let item = [];
      let list = [];
      for(let i in data){
        if(i > 0){
              item = [];
              for(let j in data[0]){
                item[data[0][j]] = data[i][j];
              }
              item = Object.assign({},item);
              list.push(item);
        }
      }
      this.process(list);
    }
    /*
       Persistência de dados pré-processamento
    */     
    async process(list){
        for(var i in list){
            let doc = list[i];
            if(doc.dataRegistro != undefined){
              var parts = doc.dataRegistro.split(" ")[0].split("/");
              var dt = new Date(
                      parseInt(parts[2], 10),
                      parseInt(parts[1], 10) - 1,
                      parseInt(parts[0], 10)
                  );
              doc.created_at = dt;
              doc.timestamp  = new Date(dt).getTime()
            }
            await this.db.collection('caso').save(doc,(err,ok)=>{ if(err)console.log('save:',i,err,ok); });
        }
        this.SOCKET.emit("save", "process ok");
    }
    /*
       Processamanto dos dados agrupados em blocos
    */     
    async group_by_day(doenca){
        var list = [];
        await this.db.collection('warning').remove({ "doenca": doenca });
        // agrupar por dia para montar o teste
        var cursor = await this.db.collection('caso').aggregate(
          {$match: { "doenca": doenca }},
          {$group: {_id: {created_at:'$created_at',timestamp:'$timestamp',doenca:'$doenca'}, casos: {$sum: 1}}},
          {$sort: { "_id.timestamp": 1}}
        );
        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
            doc.data     = doc._id.created_at;
            doc.datatime = doc._id.timestamp;
            doc.doenca   = doc._id.doenca;
            delete doc._id;
            await this.db.collection('warning').save(doc);
        }
    }
    /*
       Pesquisa por blocos
    */     
    async get_warms(doenca){
        let warms = [];
        var cursor = await this.db.collection('warning').find({ "doenca": doenca }).sort({'datatime':1});
        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
            warms.push(doc);
        }
        return warms;
    }
    /*
       Persistência pós-processamanto
    */ 
    async scores(doenca,data=[],socket){
        await this.db.collection('score').remove({'doenca':doenca});
        for (let i in data) {
           await this.db.collection('score').save(data[i]);
        }
        try{
           socket.emit("save", doenca, "process scores ok - "+doenca,data);
        }catch(e){

        }
        return true;
    }
    /*
       Consulta scores
    */     
    async getScores(disease_filter={},filter={},ret=false){
        console.log('getScores',disease_filter,filter)
        let scores = [];
        var cursor = await this.db.collection('score').find(disease_filter).sort(filter);
        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
              doc.sum = 0;
            for(let i in doc.list)
              doc.sum += doc.list[i];
            scores.push(doc);
        }
        let tmp = (disease_filter.doenca) ? disease_filter.doenca : '';

        if(!ret)
           this.SOCKET.emit("getScores", tmp, scores);
        else
          return scores;
    }
    /*
       Consulta doenças
    */    
    async getCasos(){
        let casos = [];
        var cursor = await this.db.collection('caso').find({}).sort({"timestamp":1});
        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
            casos.push(doc);
        }
        var cursor = await this.db.collection('score').find({});
        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
              doc.sum = 0;
            for(let i in doc.list)
              doc.sum += doc.list[i];
            casos.push(doc);
        }
        this.SOCKET.emit("getCasos", casos);
    }
    /*
       Agrupar doenças em blocos
    */     
    async getDiseases(){
        let diseases = [];
        // agrupa por dia para montar o teste
        var cursor = await this.db.collection('caso').aggregate(
          {$group: {_id: {doenca:'$doenca'}, casos: {$sum: 1}}},
          {$sort: { "_id.timestamp": 1}}
        );
        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
            doc.doenca   = doc._id.doenca;
            diseases.push(doc);
        }
        this.SOCKET.emit("getDiseases", diseases);
    }
}
/*
   Exporta API
*/ 
module.exports = oAPI;
