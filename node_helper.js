var NodeHelper = require("node_helper");
var fs = require("fs");
var Path = require('path');
var MusicMetaData = require('musicmetadata');
var groove = require("groove");
var Pend = require('pend');
var Batch = require('batch');
var Async = require('async');
var assert = require('assert');

var volumeValue = 1.0;

var current_playlist = [];
var playlists = [];
//var folder_structure = [];
var current_song=0;
var stop_flag = false;
var playstatus = "stopped";
var skip_flag = false;

module.exports = NodeHelper.create({
  start: function() {
    var self=this;
    self.supported_file_extensions= [ "mp3" ];
    self.folder_structure = [];
    self.loop = "noloop";
    self.shuffle = false;
    console.log("Started nodehelper for SMP");
    self.playlist = groove.createPlaylist();
    self.player = groove.createPlayer();
    self.player.useExactAudioFormat = true;
    self.player.on('devicereopened', function() {
      //console.log("Device re-opened");
    });

    self.player.on('nowplaying', function() {
      if(playstatus == "stopped"){
        console.log("Stop flag triggered");
        return;
      }
      var current = self.player.position();
      if (!current.item) {
        if(current_song == current_playlist.length - 1){
          console.log("End of playlist");
          if(self.shuffle){
            console.log("shuffle is activated");
            self.play_song(Math.floor((Math.random() * current_playlist.length)));
          }
          if(self.loop == "loop"){
            console.log("looping playlist");
            self.play_song(0);
            return;
          }
          self.sendSocketNotification("UPDATE_POSITION", { pos: 0, duration: 0, stop: true, start: false });
          clearInterval(self.pos_update_interval);
          playstatus = "stopped";
          self.player_cleanup(function(){});
          return;
        } else {
          console.log("next track because end of song");
          if(self.loop == "loop1"){
            self.play_song(current_song);
          } else {
            if(self.shuffle){
              console.log("playing shuffle");
              self.play_song(Math.floor((Math.random() * current_playlist.length)));
            }
            else self.play_song(current_song+1);
          }
        }
        return;
      }
      var artist = current.item.file.getMetadata('artist');
      var title = current.item.file.getMetadata('title');
      if(!skip_flag) console.log("Now Playing: " + title + " - " + artist);
      skip_flag = false;
    });
  },

  player_cleanup: function(cb){
    var self=this;
    var batch = new Batch();
    var files = self.playlist.items().map(function(item) { return item.file; });
    self.playlist.clear();
    files.forEach(function(file) {
      batch.push(function(cb) {
        file.close(cb);
      });
    });
    batch.end(function(err) {
      self.player.detach(function(err) {
        if (err) console.error("Fehler: "+err.stack);
        else cb();
      });
    });
  },

  play_song: function(tracknumber){
    var self=this;
    self.player_cleanup(function(){
      current_song = tracknumber;
      self.load_file(current_song);
      playstatus = "playing";
      self.sendSocketNotification("NEWFILE",
          { title: current_playlist[current_song].title,
            interpret: current_playlist[current_song].interpret,
            tracknumber: current_song });
    });
    return;
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
            if (err) throw err;
            //console.log(metadata);
            var index = indexOfPath(results, item.path);
            if(index == -1) {console.log("not found "+item.path); callback(); return;}
            results[ index ].title = metadata.title;
            results[ index ].interpret = metadata.artist[0];
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
            current_song = 0;
            playstatus = "playing";
            self.sendSocketNotification("UPDATE_POSITION", { pos: 0, duration: 1, stop: false, start: true});
            self.load_file(current_song);
          }
        });
    });
  },

  load_playlist: function(path, autoplay) {
    var self = this;

   function load_m3u_playlist(path){
      fs.readFile(path, 'utf8', function(err, data){
        if(err){
          return console.log(err);
        }
        lines = data.split(/\r?\n/);
        var i;
        var list = [];
        var title ="";
        var interpret = "";
        var duration = 0;
        for(i=0;i<lines.length;i++){
          if( lines[i].startsWith("#EXTINF") ){
            duration = parseInt(lines[i].substr(8,lines[i].indexOf(",",8)-8));
            interpret = lines[i].substr(lines[i].indexOf(",",8)+1, lines[i].indexOf(" - ")-lines[i].indexOf(",")-1);
            title = lines[i].substr(lines[i].indexOf(" - ")+3);
          } else if(!lines[i].startsWith("#") && lines[i]!== ""){
            list.push({title: title, interpret: interpret, duration: duration, path: decodeURI(lines[i].substr(7)), filehandle: null});
          }
        }
        self.initiatePlaylist(list,path.substr(path.lastIndexOf("/")+1, path.lastIndexOf(".")-1-path.lastIndexOf("/")), autoplay);
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
      current_song = 0;
      playstatus = "playing";
      this.sendSocketNotification("UPDATE_POSITION", { pos: 0, duration: 1, stop: false, start: true});
      this.load_file(current_song);
    }
  },

  load_file: function(tracknumber) {
    var self=this;
    var batch = new Batch();
    batch.push(openMusicFile(current_playlist[tracknumber]));
    batch.end(function(err, files){
      if(files){
        files.forEach(function(file){
          if(file) {
            self.playlist.insert(file);
            current_playlist[tracknumber].duration = file.duration();
          }
        });
        self.player.attach(self.playlist, function(err) {
          if(err) console.log(err.stack);
          assert.ifError(err);
        });
        
        self.pos_update_interval = setInterval(function() {
          var pos = self.player.position();
          var files = self.playlist.items().map(function(item) { return item.file; });
          if(pos.item){
            self.sendSocketNotification("UPDATE_POSITION", { pos: pos.pos, duration: files[0].duration(), stop: false, start: false});
          }
        }, 1000);
      } else {
        console.log("No files could be loaded:");
        console.log(err.stack);
        self.sendSocketNotification("LOADINGERROR",'');
      }
    });

    function openMusicFile(track) {
      return function(cb) {
        groove.open(track.path, cb);
      };
    }
  },

  socketNotificationReceived: function(notification, payload) {
    var self=this;
    switch(notification){
      case "INITIALIZE":
        var readplaylists = function(done){
          fs.readdir("./modules/MMM-SMP-Simple-Music-Player/public/playlists/", (err, files) => {
            var playlist_list = [];
            files.forEach(file => {
              if(self.supported_file_extensions.indexOf(file.substring(file.lastIndexOf(".")+1)) != -1){
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
        if(playstatus == "playing"){
          clearInterval(self.pos_update_interval);
          playstatus = "stopped";
          self.player_cleanup(function(){
            self.load_playlist("./modules/MMM-SMP-Simple-Music-Player/public/playlists/"+payload.name, payload.autoplay);
          });
          break;
        }
        this.load_playlist("./modules/MMM-SMP-Simple-Music-Player/public/playlists/"+payload.name, payload.autoplay);
        break;
      case "LOADFOLDER": //payload {name, path, recursive}
        if(playstatus == "playing"){
          clearInterval(self.pos_update_interval);
          playstatus = "stopped";
          self.player_cleanup(function(){
            self.load_folder(payload.name, payload.path, payload.recursive, payload.autoplay);
          });
          break;
        }
        self.load_folder(payload.name, payload.path, payload.recursive, payload.autoplay);
        break;
      case "LOADFILE": //payload: number of current song
        current_song = payload;
        playstatus = "playing";
        self.load_file(payload);
        break;
      case "PAUSEFILE":
        self.playlist.pause();
        break;
      case "RESUMEFILE":
        self.playlist.play();
        break;
      case "STOPFILE":
        if(playstatus == "stopped") break;
        clearInterval(self.pos_update_interval);
        playstatus = "stopped";
        self.player_cleanup(function(){});
        break;
      case "NEXTFILE":
        console.log("nextfile");
        if(self.shuffle) current_song = Math.floor(Math.random()*current_playlist.length);
        else if(current_song >= current_playlist.length - 1){
          if(self.loop == "loop") current_song = 0;
          else                         break;
        } else current_song++;
        if(playstatus != "playing"){
          self.sendSocketNotification("NEWFILE",
            {title: current_playlist[current_song].title,
            interpret: current_playlist[current_song].interpret,
            tracknumber: current_song });
          break;
        }
        clearInterval(self.pos_update_interval);
        playstatus = "stopped";
        self.play_song(current_song);
        break;
      case "PREVIOUSFILE":
        console.log("previous file");
        if(self.shuffle) current_song = Math.floor(Math.random()*current_playlist.length);
        else if(current_song <= 0) {
          if(self.loop == "loop") current_song = current_playlist.length -1;
          else break;
        } else current_song--;
        if(playstatus != "playing"){
          self.sendSocketNotification("NEWFILE",
            {title: current_playlist[current_song].title,
            interpret: current_playlist[current_song].interpret,
            tracknumber: current_song });
          break;
        }
        clearInterval(self.pos_update_interval);
        playstatus = "stopped";
        self.play_song(current_song);
        break;
      case "VOLUMECHANGE":
        volumeValue = payload / 100;
        self.playlist.setGain(volumeValue);
        break;
      case "PLAYERSETTINGS":
        self.loop = payload.loop;
        self.shuffle = payload.shuffle;
        console.log("Setting " + self.loop + " and shuffle " + self.shuffle);
        break;
      case "TIMECHANGE":
        if(skip_flag) break;
        var duration = current_playlist[current_song].duration;
        console.log("duration: "+duration);
        var pos = self.player.position();
        if(payload.newposition != undefined){
          skip_flag = true;
          self.playlist.seek(pos.item, payload.newposition/100.0*duration);
        } else {
          var newpos = 0;
          switch(payload.direction){
            case "backwards":
              if(pos.pos < duration/20)
                newpos = 0;
              else  newpos = pos.pos - (duration/20);
              break;
            case "forward":
              if(pos.pos + (duration/20) > duration)
                newpos = duration - 1; // -1 for introducing a small buffer, before the next file will be played automatically
              else  newpos = pos.pos + (duration/20);
              break;
          }
          skip_flag = true;
          self.playlist.seek(pos.item, newpos);
        }
        break;
    }
  },
});
