var brain = require('brain.js');

class oAPI{
    constructor(socket,mongo){
        this.SOCKET    = socket;
        this.MONGO     = mongo;
        this.net       = new brain.NeuralNetwork({
                              learningRate: 0.6 // global learning rate, useful when training using streams
                            });
        //scenes=10  ,days=7
        let train = this.dataTrain(7, 7);
        this.net.trainAsync(train);
    }
    async send(){
         let result = [];
         let list = await this.MONGO.group_by_day();
         //console.log('group_by_day',list);
         let data = this.mount_test(list);
         //console.log('mount_test',data);
         //
         for(let i in data){
           data[i].score = this.net.run(data[i].list);
           //if(list[i].score.item >= 0.8)
            result.push(data[i]);
         }
         //console.log('list',list);
         await this.MONGO.scores(result);
         this.SOCKET.emit("save", "process scores ok");
    }
    dataTrain(scenes,days){
        let sum   = 0;
        let train = [];
        let item  = new Object();
        for(let i=0; i<= scenes; i++){
            item = new Object();
            for(let j=sum; j<= (days+sum); j++){
               item['d'+(j-sum)] = j;
            }
          sum++;
          train.push({input: item, output: { item: 1 }});
        }
        //trainar o negativo --inverte os dados do treino
        for(let i in train){
          let tmp = [];
          for(let j in train[i].input){
             tmp.push(train[i].input[j]);
          }
          tmp.reverse();
          item  = new Object();
          for(let x in tmp){
             item['d'+x] = tmp[x];
          }
          train.push({input: item, output: { item: 0 }});
        }
        //console.log('train',train);
      return train;
    }
    mount_test(list){
      //com base nos warms monta o test
      let data  = [];
      let count = 1;
      let index = 0;
      let item  = new Object();
      for (let i in list){
          if(data[index] == undefined) data[index] = {'score':0,'list':[]};
          item['d'+count] = list[i].casos;
         if(count == 1){
            data[index].datatime = list[i].data;
            data[index].data = new Date(list[i].data);
         }
         //console.log(i,this.proc.length);
         if(count >= 7 || parseInt(i) == (list.length-1)){
            data[index].datatimeEnd = list[i].data;
            data[index].dataEnd = new Date(list[i].data);
            data[index].list = item;
            //
            index++;
            count = 0;
            item  = new Object();
         }
         count++;
      }
      return data;
    }
}

module.exports = oAPI;
