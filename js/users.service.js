(function() {
  'use strict';

  angular.module('talis.services.user', []).factory('UsersService', ['$rootScope','$http', 'PERSONA_ENDPOINT', 'TDC_ENDPOINT',function($rootScope,$http,PERSONA_ENDPOINT,TDC_ENDPOINT) {
    var instance = function(){};

    /**
     * Fetches user based on guid
     * @param user_guid
     * @param callback
     */
    instance.get = function(user_guid,callback) {
      $http.get(PERSONA_ENDPOINT+"/users/"+user_guid).success(function(response) {
        $rootScope.working = false;
        callback(null,response);
      }).error(function(response) {
          if (response.status !== 404) {
            $rootScope.working = false;
            callback("User not found",null);
          } else {
            if (response.data && response.data.error) {
              callback(response.data.error_description,null);
            } else {
              callback("Unknown error, status code: "+response.status,null);
            }
          }
        });
    };

    /**
     * Logs you out of Persona
     * @param callback
     */
    instance.logout = function(callback){
      $http.get(PERSONA_ENDPOINT+"/auth/logout").success(function(response) {
        console.log("User was Logged out");
        callback(null,response);
      }).error(function(response) {
          console.log("Error Logging Out: ", response);
        });
    };

    /**
     * Returns the profile for the currently logged in user
     * @param callback
     */
    instance.getLoginData = function(callback) {
      $http.jsonp(PERSONA_ENDPOINT+'/auth/login.json?cb=JSON_CALLBACK').then(function(response) {
        if (response.status===200) {
          if (response.data) {
            var user = response.data;
            user.isAdmin = false;
            user.oauth.scope.forEach(function(s) {
              if (s==="su") {
                user.isAdmin = true;
              }
            });
            // further check user record exists in tdc... this is required as users can sign into persona but they might not have invites to t.com
            $http.get(TDC_ENDPOINT + '/users/'+user.guid).then(function(response) {
              if (response.data.properties) {
                // add in any TDC specific settings
                user.properties = response.data.properties;
              }
              callback(null,user);
            },function(response) {
              if (response.status === 404) {
                // user does not exist in tdc.com yet - for now, only invited users allowed
                if (user.isAdmin) {
                  callback(null,user); // always let admin users in anyway even if not invited
                } else {
                  callback("not_registered",user);
                }
              } else {
                callback("An error occurred whilst checking the user's invitation status",null);
              }
            });
          } else {
            callback("No data received for user",null);
          }
        }
      }, function(response) {
        // this is an error flow but we do not want to
        // return an error in the call back because the first
        // time around their is no user!
        callback(null,null);
      });
    };

    /**
     * Updates the user profile
     * @param user
     * @param callback
     */
    instance.updateProfile = function(user,callback) {
      $http.put(TDC_ENDPOINT + '/users/'+user.guid+'/profile',user.profile).then(function(response) {
        $rootScope.working = false;
        $rootScope.error = false;
        instance.regenHomeFeed(user);
        callback(null,user.profile);
      },function(response) {
        $rootScope.working = false;
        if (response.data && response.data.error) {
          $rootScope.error = response.data.error_description;
        } else {
          $rootScope.error = "Unknown error, status code: "+response.status;
        }
        callback($rootScope.err,null);
      });
    };

    /**
     * Updated the last login date for the user
     * @param user
     */
    instance.setLastLogin = function(user) {
      $http.post(TDC_ENDPOINT + '/users/'+user['guid']+'/login');
    };

    /**
     * Helper method, to set any property name/val on a user
     * @param user
     * @param propertyName
     * @param propertyValue
     */
    instance.setProperty = function(user,propertyName,propertyValue) {
      var propVal = {};
      propVal[propertyName] = propertyValue;
      if (user.properties==null) {
        user.properties = {};
      }
      user.properties[propertyName] = propertyValue;
      $http.post(TDC_ENDPOINT + '/users/'+user['guid']+'/properties',propVal);
    };

    return instance;
  }]);

}).call(this);
