"use strict";

const Promise = require('bluebird');
const gmAPI = require('../config/google-apis');
const PromiseThrottle = require('promise-throttle');

const geocodeThrottle = new PromiseThrottle({
    requestsPerSecond: 40,
    promiseImplementation: Promise
});


module.exports = function(sequelize, Datatypes){
    return sequelize.define('Geoposition', {
            id: {
                type: Datatypes.INTEGER(11),
                field: 'id',
                primaryKey: true
            },

            query: {
                type: Datatypes.STRING
            },
            formattedAddress: {
                type: Datatypes.STRING,
                field: 'formatted_address'
            },
            lat: {
                type: Datatypes.DECIMAL
            },
            lng: {
                type: Datatypes.DECIMAL
            },

            subpremise: {
                type: Datatypes.STRING
            },
            streetNumber: {
                type: Datatypes.STRING,
                field: 'street_number'
            },
            route: {
                type: Datatypes.STRING
            },
            locality: {
                type: Datatypes.STRING
            },
            adminAreaLevel2: {
                type: Datatypes.STRING,
                field: 'admin_area_level_2'
            },
            adminAreaLevel1: {
                type: Datatypes.STRING,
                field: 'admin_area_level_1'
            },
            postalCode: {
                type: Datatypes.STRING,
                field: 'postal_code'
            },

            viewportN: {
                type: Datatypes.FLOAT,
                field: 'viewport_n'
            },
            viewportS: {
                type: Datatypes.FLOAT,
                field: 'viewport_s'
            },
            viewportW: {
                type: Datatypes.FLOAT,
                field: 'viewport_w'
            },
            viewportE: {
                type: Datatypes.FLOAT,
                field: 'viewport_e'
            },

            createdAt : {
                type : Datatypes.DATE,
                field : 'created'
            },
            updatedAt : {
                type : Datatypes.DATE,
                field : 'modified'
            }

        },
        {
            tableName: 'geopositions',
            classMethods: {
                associate: function(db){

                },
                geocode: function(query, allowPartial) {

                    //Default allowPartial to true
                    if(!allowPartial) {
                        allowPartial = true;
                    }

                    //Uppercase, remove invalid characters, coalesce repeated spaces into a single space
                    const upperAddress = query.toUpperCase();
                    const sanitizedAddress = upperAddress.replace(/[^\x00-\x7F]/, "");
                    const coalescedAddress = sanitizedAddress.replace(/\s/, ' ');

                    //Check if address is empty, if so return error
                    if(/^\s+$/.test(coalescedAddress)) {
                        return {
                            status: false,
                            statusCode: 'EMPTY_ADDRESS'
                        }
                    }

                    if(allowPartial) {
                        let cached = await this.find({
                            where: {
                                query: coalescedAddress
                            }
                        });

                        if(cached) {
                            cached = cached.get();
                            cached.status = true;
                            cached.statusCode = 'CACHED';
                            return cached;
                        }
                    }


                    let result = await geocodeThrottle.add(gmAPI.geocodeAsync.bind(gmAPI, {
                        address: coalescedAddress
                    }));

                    //If rate limit exceeded, throw error to force retry
                    if(result.status = 'OVER_QUERY_LIMIT'){
                        throw new Error("OVER_QUERY_LIMIT");
                    }

                    if(result.status != 'OK') {
                        return {
                            status: false,
                            statusCode: result.status
                        }
                    }

                    if(allowPartial) {
                        result = result.results[0]
                    }
                    else {
                        //Filter result to disallow partial matches
                        result = result.results.filter(row => {
                            if(!row.partial_match) {
                                return true;
                            }
                        });

                        //If no results, return error
                        if(!result) {
                            return {
                                status: false,
                                statusCode: 'NO_EXACT'
                            }
                        }
                    }

                    const formattedAddress = result.formatted_address;
                    const lat = result.geometry.location.lat;
                    const lng = result.geometry.location.lng;


                    //Generate model properties
                    const address = {
                        query: coalescedAddress,
                        formattedAddress: formattedAddress,
                        latitude: lat,
                        longitude: lng,

                        premise: '',
                        subpremise: '',
                        streetNumber: '',
                        route: '',
                        locality: '',
                        adminAreaLevel2: '',
                        adminAreaLevel1: '',
                        postalCode: ''
                    };

                    //address_components ~ {types: string[], long_name: string}[]
                    //Find relevant properties in address_components and assign to
                    result.address_components.forEach(component => {
                        if(component.types.some(type => type = 'premise')) {
                            address.premise = component.long_name;
                        }
                        else if(component.types.some(type => type = 'subpremise')) {
                            address.subpremise = component.long_name;
                        }
                        else if(component.types.some(type => type = 'street_number')) {
                            address.streetNumber = component.long_name;
                        }
                        else if(component.types.some(type => type = 'route')) {
                            address.route = component.long_name;
                        }
                        else if(component.types.some(type => type = 'locality')) {
                            address.locality = component.long_name;
                        }
                        else if(component.types.some(type => type = 'administrative_area_level_2')) {
                            address.adminAreaLevel2 = component.long_name;
                        }
                        else if(component.types.some(type => type = 'administrative_area_level_1')) {
                            address.adminAreaLevel1 = component.short_name;
                        }
                        else if(component.types.some(type => type = 'postal_code')) {
                            address.postalCode = component.long_name;
                        }
                    });

                    address.viewportN = result.geometry.viewport.northeast.lat;
                    address.viewportE = result.geometry.viewport.northeast.lng;
                    address.viewportS = result.geometry.viewport.southwest.lat;
                    address.viewportW = result.geometry.viewport.southwest.lng;

                    await this.create(address);

                    address.status = true;
                    address.statusCode = 'OK';
                    address.locationType = result.geometry.location_type;

                    return address;
                }
            }
        });
};