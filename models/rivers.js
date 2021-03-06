const fs = require('fs');
const calculate = require('../controllers/calculation');

class Rivers {
    constructor() {
        this.riverList = {};
        this.eggPerFemale = 3000;
        this.marineSalmonSurvivingRate = 0.1; //according to the http://library.state.or.us/repository/2011/201108261007475/index.pdf

        this.closedRiverList = [];
        this.evaluatedRiverList = [];
    }

    loadFromFile(filePath) {
        return new Promise ((resolve, reject) => {
            fs.readFile(filePath, (err, result) => {
                if (err) reject(err);
                let data = JSON.parse(result);
                this.riverList = data.riverList;
                resolve(data);
            });
        })
    }

    getRiverList() {
        return Object.keys(this.riverList);
    }

    // saveRiverToFile(riverName, data) {
    //     fs.readdir('./data', (err,result) => {
    //         if (err) throw err;
    //         else {
    //             let fileArr = [];
    //             result.forEach(file => {
    //                 console.log("FILE: ",file);
    //                 if(file==riverName+".json"){
    //                     console.log("Match");
    //                     let newData = data.branches;
    //                     console.log(newData);
    //                     loadFromFile(file).then()
    //                 }
    //             });
    //         }

    //     });
    //     fs.writeFileSync(`./data/${riverName}.json`, JSON.stringify(data, null, 4));
    // }

    calculateN(riverName) {
        let population = 0;
        let x = 0;
        let k = 0;
        let p = 0;
        let t = 0;
        for (let i = 0; i < this.riverList[riverName].sweeps.length; i++) {
            k = i;
            t = this.riverList[riverName].sweeps[i];
            x = x + t
            p = (-k*3*t*x + k*3*3*x)/(k*3*x*x - 3*3*x*x)
        }
        population = (3*t + p*3*x)/(k*p)
        return population
    }

    calculateNRedds(river){
        var nRedds = 0;
        let L = river.fishLength;
        let D50 = river.D50;
        let D84 = river.D84;
        nRedds = 100*Math.pow((3.3*Math.pow((L/600),2.3))*1+Math.pow(Math.E,-1.702*((Math.log(115)/Math.log(10)+0.62*Math.log(L/600)/Math.log(10)-Math.log(D50)/Math.log(10))/(Math.log(D84)/Math.log(10)/Math.log(D50)/Math.log(10)))),-1)
        nRedds = nRedds*river.length/2000
        console.log('Redd Number: ' + nRedds)
        return nRedds;
    }

    calculateParrSurvivingNumber(numberOfEggs, eggLimit){ //Add E, const for demo purpose
        var E = 0.946*0.03;
        var D = numberOfEggs;
        var Dm = eggLimit
        //var Dm = numberOfEggsToSurvive; //increase and get worse results
        var P = D/Dm;
        console.log(D, Dm)
        console.log("P is: ",P);
        var eggToParrSurvivingRate = 0.079*Math.pow(P,-0.699)*Math.pow(Math.E,E);
        var parrSurvivedNumber = D*eggToParrSurvivingRate;
        console.log("eggToParrSurvivingRate is: ",eggToParrSurvivingRate);
        console.log("Number of Parr survive: ",D*eggToParrSurvivingRate);
        return parrSurvivedNumber;
    }

    calculateSmoltsSurvivingRate(riverName){ //Add the number of smolts, and E, and C. They are constants for demo purpose
        var W = parseFloat(riverName.channelWidth) //channel width in teh active spot
        var G = parseFloat(riverName.gradient)//gradient (slope) of the river in percent
        var B = parseFloat(riverName.beaverDams) //biver damns per km
        var L = parseFloat(riverName.L)// arc sine square root transformation of the percent of pool in the reach
        var C = Math.pow((0.4 - 0.0682*Math.log(W) - 0.0330*G + 0.1030*B + 0.2020*L), 2)//smolt density
        console.log('C: ', C)
        var smoltSurvivingRate = 0.1361*(Math.log(C))+0.487;
        console.log("smoltSurvivingRate is: ",smoltSurvivingRate);
        return smoltSurvivingRate;
    }

    riverIsClosed (riverName) {
        if (this.closedRiverList.indexOf(riverName) >= 0) {
            return true
        } else {
            return false
        }
    }

    riverIsEvaluated (riverName) {
        if (this.evaluatedRiverList.indexOf(riverName) >= 0) {
            return true
        } else {
            return false
        }
    }

    calculateSurvivingAdultSalmon (river, eggIncrease = 0) {

        console.log('\n Evaluating: ', river.riverName)
        // Calculate the egg limit this river can contain:
        let numberOfReeds = this.calculateNRedds(river);
        
        // Calculate number of eggs flushed to the connected river:
        let eggLimit = numberOfReeds*this.eggPerFemale;
        let actualEggNumber = (river.riverPopulation/2)*this.eggPerFemale;
        let totalNumberOfEggs = actualEggNumber + eggIncrease;
        console.log('asjhkdfgkjkash', totalNumberOfEggs, eggIncrease)

        //Calculate parrs, smolts, and adult salmon
        let numberOfParrs = this.calculateParrSurvivingNumber(totalNumberOfEggs, eggLimit)
        let numberOfSmolts = numberOfParrs*this.calculateSmoltsSurvivingRate(river);
        console.log("numberOfSmolts is: ", numberOfSmolts);
        let numberOfAdultSalmon = this.marineSalmonSurvivingRate * numberOfSmolts;
        console.log("numberOfAdultSalmon is: ", numberOfAdultSalmon);
        
        return numberOfAdultSalmon;
    }

    async calculateConnectedRiverImpact(connectedRiverName, eggIncrease) {
        if (!this.riverIsClosed(connectedRiverName) && !this.riverIsEvaluated(connectedRiverName)) {
            let connectedRiver = this.riverList[connectedRiverName];
            this.evaluatedRiverList.push(connectedRiverName)
            if (connectedRiver.connections.length == 0) {
                this.riverList[connectedRiverName].riverPopulation = this.calculateSurvivingAdultSalmon(connectedRiver, eggIncrease)
                return this.riverList;
            } else {
                // Evaluate second layer of connections:
                let numberofRiverEvaluatedThisInstance = 0;
                let listofViableRiver = [];
                connectedRiver.connections.forEach((item, index, array) => {
                    if (!this.riverIsClosed(item) && !this.riverIsEvaluated(item)) {
                        listofViableRiver.push(item)
                    }
                    numberofRiverEvaluatedThisInstance++;
                    if (numberofRiverEvaluatedThisInstance == array.length) {
                        if (listofViableRiver.length == 0) {
                            this.riverList[connectedRiverName].riverPopulation = this.calculateSurvivingAdultSalmon(connectedRiver, eggIncrease);
                            return this.riverList;
                        } else {
                            this.riverList[connectedRiverName].riverPopulation = this.calculateSurvivingAdultSalmon(connectedRiver, eggIncrease/2);
                            listofViableRiver.forEach((viableRiver) => {
                                this.calculateConnectedRiverImpact(viableRiver, (eggIncrease/2)/listofViableRiver.length)
                            })
                        }
                    }
                })
            }
        } else {
            return this.riverList;
        }
    }

    calculateRiverImpact(riverName) {
        return new Promise((resolve, reject) => {
            if (!this.riverIsClosed(riverName)) {
                this.closedRiverList.push(riverName)
            }

            if (this.riverList[riverName] == null) {
                reject ({
                    "error": "No such river or branch in database"
                })
            }

            let connectedRivers = this.riverList[riverName].connections;
            let eggIncrease = ((this.riverList[riverName].riverPopulation/2)*this.eggPerFemale);

            this.riverList[riverName].riverPopulation = 0;

            let numberofConnectedRiverEvaluated = 0;
            connectedRivers.forEach((connectedRiverName, index, array) => {
                numberofConnectedRiverEvaluated++;
                this.calculateConnectedRiverImpact(connectedRiverName, eggIncrease).then((result) => {
                    if (numberofConnectedRiverEvaluated == array.length) {
                        resolve(this.riverList);
                    }
                })
            })
            resolve(this.riverList)
        })
    }

    calculateRiverImpactAfterCertainInterval (riverName, interval) {
        return new Promise((resolve, reject) => {
            for (let i = 0; i < interval; i++) {
                this.calculateRiverImpact(riverName).then((result) => {

                })
            }

        })
        
    } 

    calculateMultipleRiversImpact (riverList) {
        return new Promise(async (resolve, reject) => {
            for (let i = 0; i < riverList.length; i++) {
                console.log(this.evaluatedRiverList)
                let result = await this.calculateRiverImpact(riverList[i]).then(result => {
                    this.evaluatedRiverList = []
                    console.log(this.evaluatedRiverList, i)
                    if (i == riverList.length - 1) {
                        resolve(this.riverList)
                    }
                }).catch((error) => {
                    console.log(error)
                })
            }
        })
    }


    // calculateImpactByClosingMultipleRivers (riverName) {        
    //     return new Promise((resolve, reject) => {
    //         let cumulativeImpactOnRiver = 0;
    //         let cumulativeImpactOnBranches = 0;
    //         let nRedds = this.calculateNRedds(600,64,84);
    //         let eggsNumber = nRedds * 3000; //3000 is eggs number
    //         let nParrs = this.calculateParrSurvivingNumber(eggsNumber*5,eggsNumber); //1st arg: layed eggs; 2nd ard: need to survive
    //         let smoltsNumber = nParrs*this.calculateSmoltsSurvivingRate();
    //         console.log(smoltsNumber);
    //         let mortalityRate = 0.12 //according to the http://www.fraserriverkeeper.ca/600000_farmed_salmon_die_of_disease_in_bc_annually
    //         let marineSalmonSurvivingRate = 0.10 //according to the http://library.state.or.us/repository/2011/201108261007475/index.pdf
    //         let adultSalmonNumber = marineSalmonSurvivingRate * smoltsNumber;
    //         console.log(adultSalmonNumber);
    //         if (this.riverList[riverName] == null) {
    //             reject ({
    //                 "error": "No such river or branch in database"
    //             })
    //         }        

    //         let riverBranches = this.riverList[riverName].branches;
    //         Object.keys(riverBranches).forEach(branch => {            
    //             let branchName = riverBranches[branch].branchName;
    //             this.calculateBranchImpact(riverName,branchName).then((result) => {
    //                 cumulativeImpactOnRiver+=result.impactOnRiverPopulation;
    //                 cumulativeImpactOnBranches+=result.lostBranchPopulation
    //                 if (Object.keys(riverBranches).indexOf(branch) == (Object.keys(riverBranches).length - 1)) {
    //                     resolve({
    //                         'cumulativeImpactOnRiver': cumulativeImpactOnRiver,
    //                         'cumulativeImpactOnBranches': cumulativeImpactOnBranches,
    //                         "nRedds": nRedds,
    //                         "smoltsNumber": smoltsNumber,
    //                         "adultSalmonNumber": adultSalmonNumber
    //                     })
    //                 }
    //                 }).catch((error) => {
    //                     console.log(error)
    //                 })
    //             })
    //     })
    // }


    // calculateCumulativeRiverImpact (riverName) {        
    //     return new Promise((resolve, reject) => {
    //         let cumulativeImpact = 0;
    //         let nRedds = this.calculateNRedds(riverName);
    //         let eggLimit = nRedds * 3000; //3000 is eggs number
    //         let nParrs = this.calculateParrSurvivingNumber(eggLimit*5,eggLimit); //1st arg: layed eggs; 2nd ard: need to survive
    //         let smoltsNumber = nParrs*this.calculateSmoltsSurvivingRate();
    //         if (this.riverList[riverName] == null) {
    //             reject ({
    //                 "error": "No such river or branch in database"
    //             })
    //         }        

    //         Object.keys(this.riverList[riverName]).forEach(river => {            
    //             this.calculateRiverImpact(river.riverName).then((result) => {
    //                 cumulativeImpact += result.impactOnRiverPopulation;                              
    //                 console.log("Cumulative Impact in percents: ", cumulativeImpact);
    //                 console.log("Cumulative Impact in fish number: ", cumulativeImpactOnBranches);
    //                 if (Object.keys(riverlist).indexOf(river) == (Object.keys(riverList).length - 1)) {
    //                     resolve({
    //                         'cumulativeImpact': cumulativeImpact,
    //                         "nRedds": nRedds,
    //                         "smoltsNumber": smoltsNumber
    //                     })
    //                 }
    //                 }).catch((error) => {
    //                     console.log(error)
    //                 })
    //             })
    //     })
    // }
}

module.exports = {
    Rivers
}