var NodeHelper = require("node_helper");
var fs = require("fs");
var Path = require('path');
var MusicMetaData = require('musicmetadata');
var Async = require('async');
var http = require('http')

var current_playlist = [];
var playlists = [];
var current_song=0;

module.exports = NodeHelper.create({
  start: function() {
    var self=this;
    self.supported_file_extensions= [ "mp3" ];
    self.supported_playlist_extensions = [ "m3u" ];
    self.folder_structure = [];
    self.server = null;
    self.streamingPort = 0;
    console.log("Started nodehelper for SMP");
  },

  load_folder: function(name, path, recursive, autoplay){
    var self=this;
    var walk = function(dir, done) {
      var results = [];
      fs.readdir(dir, function(err, list) {
        if (err) return done(err);
        var pending = list.length;
        if (!pending) return done(null, results);
        list.forEach(function(file) {
          file = Path.resolve(dir, file);
          fs.stat(file, function(err, stat) {
            if (stat && stat.isDirectory()) {
              if(recursive){
                walk(file, function(err, res) {
                  results = results.concat(res);
                  if (!--pending) done(null, results);
                });
              } else {
                if (!--pending) done(null, results);
              }
            } else {
              if(self.supported_file_extensions.indexOf(file.substring(file.lastIndexOf(".")+1)) != -1){
                results.push({path: file });
              }
              if (!--pending) done(null, results);
            }
          });
        });
      });
    };

    var indexOfPath = function(array, path){
      for(var i=0;i<array.length;i++){
        if(array[i].path == path){
          return i;
        }
      }
      return -1;
    }

    walk(path, function(err, results){
      if(err) throw err;
      Async.each(results,
        function(item, callback){
          var readableStream = fs.createReadStream(item.path);
          var parser = MusicMetaData(readableStream, function(err, metadata) {
            var index = indexOfPath(results, item.path);
            if(index == -1) {console.log("not found "+item.path); callback(); return;}
            if (err) {
              console.log("Could not read metadata for file "+item.path);
              results[ index ].title = item.path.substring(item.path.lastIndexOf("/")+1);
              results[ index ].interpret = "";
            } else {
              //console.log(metadata);
              results[ index ].title = metadata.title;
              results[ index ].interpret = metadata.artist[0];
            }
            readableStream.close();
            //console.log(results[index]);
            callback();
          });
        },
        function(err){
          if(err) throw err;
          if(results.length == 0){
            self.sendSocketNotification("LOADINGERROR",'');
            return;
          }
          current_playlist = results;
          current_song = 0;
          //console.log(current_playlist);
          self.sendSocketNotification("LOADEDPLAYLIST", {playlist: current_playlist, name: "Folder: " + name});
          if(autoplay){
            self.load_file(current_song);
          }
        });
    });
  },

  load_playlist: function(path, autoplay) {
    var self = this;
    
    var indexOfPath = function(array, path){
      for(var i=0;i<array.length;i++){
        if(array[i].path == path){
          return i;
        }
      }
      return -1;
    }

    function load_m3u_playlist(path){
      fs.readFile(path, 'utf8', function(err, data){
        if(err){
          return console.log(err);
        }
        lines = data.split(/\r?\n/);
        var i;
        var list = [];
        for(var i=0;i<lines.length;i++){
          if(lines[i] != "" && lines[i].substr(0,1)!="#"){
            list.push({path: decodeURI(lines[i].substr(lines[i].indexOf("//")+1))});
          }
        }
        Async.each(list,
          function(item, callback){
            var readableStream = fs.createReadStream(item.path);
            var parser = MusicMetaData(readableStream, function(err, metadata) {
              var index = indexOfPath(list, item.path);
              if(index == -1) {console.log("not found "+item.path); callback(); return;}
              if (err) {
                console.log("Could not read metadata for file "+item.path);
                list[ index ].title = item.path.substring(item.path.lastIndexOf("/")+1);
                list[ index ].interpret = "";
              } else {
                //console.log(metadata);
                list[ index ].title = metadata.title;
                list[ index ].interpret = metadata.artist[0];
              }
              readableStream.close();
              //console.log(results[index]);
              callback();
            });
          },
          function(err){
            if(err) throw err;
            if(list.length == 0){
              self.sendSocketNotification("LOADINGERROR",'');
              return;
            }
            self.initiatePlaylist(list,path.substr(path.lastIndexOf("/")+1, path.lastIndexOf(".")-1-path.lastIndexOf("/")), autoplay);
          });
      });
    }
    
    if(path.endsWith(".m3u")){
      load_m3u_playlist(path);
    }
  },

  initiatePlaylist: function(playlist, name, autoplay) {
    current_playlist = playlist;
    current_song = 0;
    this.sendSocketNotification("LOADEDPLAYLIST", {playlist: current_playlist, name: "Playlist: " + name});
    if(autoplay){
      this.load_file(current_song);
    }
  },

  createMP3Server: function(res){
    const stream = fs.createReadStream(current_playlist[current_song].path);
    stream.pipe(res);
  },

  load_file: function(tracknumber) {
    var self=this;
    if(fs.existsSync(current_playlist[tracknumber].path)){
      if(self.server != null) self.server.close();
      self.server = http.createServer(function (req, res) {
        self.createMP3Server(res);
      });
      self.server.listen(self.streamingPort);
      self.sendSocketNotification("NEWFILE", {tracknumber: tracknumber, title: current_playlist[tracknumber].title, artist: current_playlist[tracknumber].interpret});
    }
  },

  socketNotificationReceived: function(notification, payload) {
    var self=this;
    switch(notification){
      case "INITIALIZE":
        this.streamingPort = payload.streamingPort;
        var readplaylists = function(done){
          fs.readdir("./modules/MMM-SMP-Simple-Music-Player/public/playlists/", (err, files) => {
            var playlist_list = [];
            files.forEach(file => {
              if(self.supported_playlist_extensions.indexOf(file.substring(file.lastIndexOf(".")+1)) != -1){
                playlist_list.push(file);
              }
            });
            console.log("Loaded Playlists:");
            playlist_list.forEach(playlist => {
              console.log(playlist);
            });
            done(playlist_list);
          })
        };
        var walk = function(dir, done) {
          var results = [];
          fs.readdir(dir, function(err, list) {
            if (err) return done(err);
            var pending = list.length;
            list.sort();
            if (!pending) return done(null, results);
            list.forEach(function(file) {
              file = Path.resolve(dir, file);
              fs.stat(file, function(err, stat) {
                if (stat && stat.isDirectory()) {
                  var newentry = {name: file.substring(file.lastIndexOf("/")+1), path: file, content: []};
                  results.push(newentry);
                  walk(file, function(err, res) {
                    newentry.content= res;
                    if (!--pending) done(null, results);
                  });
                } else {
                  //results.push(file);
                  if (!--pending) done(null, results);
                }
              });
            });
          });
        };
        var print_folder_structure = function(folder_structure, ebene){
          for(var i=0;i<folder_structure.length;i++){
            console.log("  ".repeat(ebene) + folder_structure[i].name);
            if(folder_structure[i].content.length > 0){
              print_folder_structure(folder_structure[i].content, ebene + 1);
            }
          }
        };
        self.folder_structure = [];
        payload.folders.sort();
        var indexOfPath = function(array, path){
          for(var i=0;i<array.length;i++){
            if(array[i].path == path) return i;
          }
          return -1;
        };
        Async.each(payload.folders,
          function(item, callback){
            if(item.indexOf("/")!=-1){
              self.folder_structure.push({name: item.substring(item.lastIndexOf("/")+1), path: item, content: [] });
            } else {
              self.folder_structure.push({name: item, content: []});
            }
            if(payload.enableFolderMenu){
              walk(item, function(err, results){
                if(err) {
                  //throw err;
                  console.log("Folder not found");
                  console.log(err);
                  self.sendSocketNotification("LOADINGERROR",'');
                  callback();
                  return;
                }
                var index = indexOfPath(self.folder_structure, item);
                if(index == -1) {console.log("Path not found: "+ item); return;}
                self.folder_structure[index].content = results;
                //print_folder_structure(self.folder_structure, 0);
                callback();
              });
            }else{
              callback();
            }
          },
          function(err){
            readplaylists(function(playlist_list){
              playlists = playlist_list;
              self.sendSocketNotification("INITIALIZE",{playlists: playlists, folder_structure: self.folder_structure});
            });
          });
        break;
      case "LOADPLAYLIST":
        this.load_playlist("./modules/MMM-SMP-Simple-Music-Player/public/playlists/"+payload.name, payload.autoplay);
        break;
      case "LOADFOLDER": //payload {name, path, recursive}
        self.load_folder(payload.name, payload.path, payload.recursive, payload.autoplay);
        break;
      case "LOADFILE": //payload: number of current song
        current_song = payload;
        self.load_file(payload);
        break;
    }
  },
});
