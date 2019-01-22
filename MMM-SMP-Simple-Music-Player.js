Module.register("MMM-SMP-Simple-Music-Player",{
  defaults: {
    enablePlaylistMenu: true,
    enableInterpetMenu: false,
    enableFolderMenu: false,
    current_button: 0,
    button_mapping: [ "play_button", "previous_button", "next_button", "stop_button", "volume_button" ],
    navistate: "ground",
    playerstate: "stopped",
    initializedDom: false,
    playlist: [],
    current_song: 0,
    volume: 100,
  },

  getStyles: function() {
    return ["style.css"];
  },
  
  start: function() {
    Log.info("Starting module: "+ this.name);
    this.playlists = [];
    this.source_menu_selected = 0;
    this.sendSocketNotification("INITIALIZE", '');
  },


  getDom: function() {
    var self = this;
    function initializeDom() {
      var wrapper = document.createElement("div");
      wrapper.id = self.identifier + "_wrapper";
      var table = document.createElement("table");
      table.className = "layouttable";
      var table_row_buttons = document.createElement("tr");
      var table_row_timeSlider = document.createElement("tr");
      var table_row_source = document.createElement("tr");
      var table_row_source_menu = document.createElement("tr");
      var table_row_currentsong = document.createElement("tr");
      var table_col_buttons = document.createElement("td");
      table_col_buttons.setAttribute("colspan", "2");
      var table_col_volumeSlider = document.createElement("td");

      var table_col_timeSlider = document.createElement("td");
      table_col_timeSlider.setAttribute("colspan", "2");
      var table_col_source = document.createElement("td");
      table_col_source.className = "sourcetextcol";
      var table_col_currentsong = document.createElement("td");
      table_col_currentsong.setAttribute("colspan", "2");
      var table_col_source_image = document.createElement("td");
      var table_col_source_menu = document.createElement("td");
      table_col_source_menu.className = "layouttable";
      table_col_source_menu.setAttribute("colspan", "2");
      table_row_timeSlider.appendChild(table_col_timeSlider);
      table_row_buttons.appendChild(table_col_buttons);
      table_row_buttons.appendChild(table_col_volumeSlider);
      table_row_source.appendChild(table_col_source_image);
      table_row_source_menu.appendChild(table_col_source_menu);
      table_row_source.appendChild(table_col_source);
      table_row_currentsong.appendChild(table_col_currentsong);
      table.appendChild(table_row_source_menu);
      table.appendChild(table_row_source);
      table.appendChild(table_row_buttons);
      table.appendChild(table_row_timeSlider);
      table.appendChild(table_row_currentsong);

      self.audioElement = document.createElement("audio");
      self.audioElement.id = self.identifier + "_audio";
      
      var timeSlider = document.createElement("div");
      timeSlider.className = "duration_progressbar";
      timeSlider.id = "duration_progressbar";
      var innerSlider = document.createElement("div");
      timeSlider.appendChild(innerSlider);

      var volumeSlider = document.createElement("div");
      volumeSlider.className = "volume_progressbar";
      volumeSlider.id = "volume_progressbar";
      var innervolumeSlider = document.createElement("div");
      innervolumeSlider.setAttribute("id", "inner_volume_slider");
      innervolumeSlider.id = "inner_volume_slider";
      volumeSlider.appendChild(innervolumeSlider);

      var source_button = document.createElement("IMG");
      source_button.className = "source";
      source_button.src = "MMM-SMP-Simple-Music-Player/source.svg";
      var source_text = document.createElement("div");
      source_text.className = "sourcetext";
      source_text.id = "sourcetext";
      source_text.innerHTML = "Choose music source...";

      self.source_menu = document.createElement("ul");
      self.source_menu.id = "sourcemenu";
      self.source_menu.className = "sourcemenu";
      //source_menu.innerHTML = "source menu";
      /*for(var i=0;i<5;i++){
        var list_element = document.createElement("li");
        list_element.innerHTML = "List Element Nr. "+i;
        source_menu.appendChild(list_element);
        var sub_list = document.createElement("ul");
        var sub_element = document.createElement("li");
        sub_element.innerHTML = "Sub Element";
        sub_list.appendChild(sub_element);
        list_element.appendChild(sub_list);
      }*/
      self.source_menu.style.visibility = "hidden";

      self.currentsong_text = document.createElement("div");
      self.currentsong_text.innerHTML = "Songtitle - Interpret";
      self.currentsong_text.id = "currentsong_text";

      var interaction_wrapper = document.createElement("div");
      interaction_wrapper.setAttribute("display", "flex");
      interaction_wrapper.setAttribute("white-space", "nowrap");
      
      var play_pause_button = document.createElement("IMG");
      play_pause_button.className = "play";
      play_pause_button.src = "MMM-SMP-Simple-Music-Player/play.svg";
      var previous_button = document.createElement("IMG");
      previous_button.className = "back";
      previous_button.src = "MMM-SMP-Simple-Music-Player/rev.svg";
      var next_button = document.createElement("IMG");
      next_button.className = "next";
      next_button.src = "MMM-SMP-Simple-Music-Player/next.svg";
      var stop_button = document.createElement("IMG");
      stop_button.className = "stop";
      stop_button.src = "MMM-SMP-Simple-Music-Player/stop.svg";
      var volume_button = document.createElement("IMG");
      volume_button.className = "volume";
      volume_button.id = "volume_button";
      volume_button.src = "MMM-SMP-Simple-Music-Player/volume3.svg";

      self.config.button_mapping = [ source_button, play_pause_button, previous_button, next_button, stop_button, volume_button, table_col_timeSlider ];

      interaction_wrapper.appendChild(play_pause_button);
      interaction_wrapper.appendChild(previous_button);
      interaction_wrapper.appendChild(next_button);
      interaction_wrapper.appendChild(stop_button);
      interaction_wrapper.appendChild(volume_button);
      interaction_wrapper.appendChild(volumeSlider);

      table_col_buttons.appendChild(interaction_wrapper);
      table_col_timeSlider.appendChild(timeSlider);
      table_col_source_image.appendChild(source_button);
      table_col_source.appendChild(source_text);
      table_col_source_menu.appendChild(self.source_menu);
      table_col_currentsong.appendChild(self.currentsong_text);
      
      table_col_buttons.className = "layouttable";
      table_col_timeSlider.className = "layouttable";
      table_col_source_image.className = "layouttable";
      //table_col_source.className = "layouttable";
      table_col_currentsong.className = "layouttable";
      table_row_source.classNmae = "layouttable";
      wrapper.appendChild(table);
      wrapper.appendChild(self.audioElement);
      
      self.config.initializedDom = true;
      self.config.wrapper = wrapper;
    }

    if(!this.config.initializedDom) {
      initializeDom();
    }
    
    var i;
    for(i=0;i<this.config.button_mapping.length;i++){
      this.config.button_mapping[ i ].style.border = "thin solid #000000";
    }
    this.config.button_mapping[ this.config.current_button ].style.border = "thin solid #FFFFFF";
    return this.config.wrapper;
  },

  getMenuEntryByIndex: function(index, element) {
    var self=this;
    for(var i=0;i< element.children.length;i++){
      if(element.children[i].children.length > 0 && element.children[i].children[0].tagName == "UL"){
        var found_index = self.getMenuEntryByIndex(index, element.children[i].children[0]);
        if(found_index !== null) return found_index;
      } else if(element.children[i].menu_index == index){
        return element.children[i];
      }
    }
    return null;
  },

  fillPlaylistMenu: function(parent_menu, playlist_list, menu_index) {
    var self=this;
    var playlist_menu = document.createElement("ul");
    playlist_menu.className = "sourcemenuEntry";
    parent_menu.appendChild(playlist_menu);

    for(var i=0; i<playlist_list.length;i++){
      var entry = document.createElement("li");
      entry.innerHTML = playlist_list[i];
      entry.menu_index = menu_index;
      entry.actiontype = "playlist";
      menu_index++;
      playlist_menu.appendChild(entry);
    }

    return menu_index;
  },

  buildSourceMenu: function(parent_list) {
    var menu_index = 0;

    //Creating Back Entry
    var back_entry = document.createElement("li");
    back_entry.className = "sourcemenuEntry";
    back_entry.innerHTML = "<--";
    back_entry.menu_index = menu_index;
    menu_index++;
    parent_list.appendChild(back_entry);

    if(this.config.enablePlaylistMenu){
      var playlist_menu = document.createElement("li");
      playlist_menu.className = "sourcemenuEntry";
      playlist_menu.innerHTML = "Playlists:";
      playlist_menu.menu_index = menu_index;
      menu_index++;

      this.playlist_list_menu = document.createElement("li");
      this.playlist_list_menu.className = "sourcemenuEntry";
      this.playlist_list_menu.id="sourcemenu_playlists_"+self.identifier;
      parent_list.appendChild(playlist_menu);
      parent_list.appendChild(this.playlist_list_menu);
      menu_index = this.fillPlaylistMenu(this.playlist_list_menu, this.playlists, menu_index);
    }

    if(this.config.enableInterpretMenu){

    }

    if(this.config.enableFolderMenu){

    }

    this.getMenuEntryByIndex(0, parent_list).className = "sourcemenuEntry_selected";
    this.sourceMenuLength = menu_index;
  },

  resetSourceMenuSelected: function(menu = this.source_menu){
    for(var i=0;i<menu.children.length;i++){
      if(menu.children[i].children.length > 0 && menu.children[i].children[0].tagName == "UL"){
        this.resetSourceMenuSelected(menu.children[i].children[0]);
      } else {
        menu.children[i].className = "sourcemenuEntry";
      }
    }
  },

  naviAction: function(action) {
    switch(action){
      case "NAVIGATE_BACK":
        switch(this.config.navistate){
          case "ground":
            this.config.current_button--;
            if( this.config.current_button < 0 ) this.config.current_button = 0;
            this.updateDom(0);
            break;
          case "volume":
            this.config.volume -= 10;
            if(this.config.volume < 0) this.config.volume = 0;
            document.getElementById("volume_button").src = "MMM-SMP-Simple-Music-Player/volume"
                                                            + Math.floor(this.config.volume / 25)
                                                            + ".svg";
            if(this.config.volume == 0){
              document.getElementById("volume_button").src = "MMM-SMP-Simple-Music-Player/volume_off.svg";
            }
            document.getElementById("inner_volume_slider").style.width = this.config.volume + "%";
            this.sendSocketNotification("VOLUMECHANGE", this.config.volume);
            break;
          case "source":
            this.source_menu_selected--;
            if(this.source_menu_selected < 0) this.source_menu_selected=0;
            Log.log("MenuIndex: Searching for " + this.source_menu_selected);
            this.resetSourceMenuSelected();
            this.getMenuEntryByIndex(this.source_menu_selected, this.source_menu).className = "sourcemenuEntry_selected";
            break;
        }
        break;
      case "NAVIGATE_FORWARD":
        switch(this.config.navistate){
          case "ground":
            this.config.current_button++;
            if( this.config.current_button >= this.config.button_mapping.length ){
              this.config.current_button = this.config.button_mapping.length - 1;
            }
            this.updateDom(0);
            break;
          case "volume":
            this.config.volume += 10;
            if(this.config.volume > 100) this.config.volume = 100;
            document.getElementById("volume_button").src = "MMM-SMP-Simple-Music-Player/volume"
                                                            + Math.floor(this.config.volume / 25)
                                                            + ".svg";
            if(this.config.volume == 0){
              document.getElementById("volume_button").src = "MMM-SMP-Simple-Music-Player/volume_off.svg";
            }
            document.getElementById("inner_volume_slider").style.width = this.config.volume + "%";
            this.sendSocketNotification("VOLUMECHANGE", this.config.volume);
            break;
          case "source":
            this.source_menu_selected++;
            if(this.source_menu_selected == this.sourceMenuLength) this.source_menu_selected=this.sourceMenuLength-1;
            Log.log("MenuIndex: Searching for " + this.source_menu_selected);
            this.resetSourceMenuSelected();
            this.getMenuEntryByIndex(this.source_menu_selected, this.source_menu).className = "sourcemenuEntry_selected";
            break;
        }
        break;
      case "NAVIGATE_OK":
        switch(this.config.navistate){
          case "ground":
            var active_element = this.config.button_mapping[this.config.current_button];
            switch(active_element.className){
              case "play":
                if(this.config.playlist.length == 0) {Log.log("*********Playlist empty");break;}
                if(this.config.playerstate == "stopped"){
                  this.config.playerstate = "playing";
                  active_element.src = "MMM-SMP-Simple-Music-Player/pause.svg";
                  this.sendSocketNotification("LOADFILE", this.config.current_song);
                } else if(this.config.playerstate == "playing"){
                  this.config.playerstate = "paused";
                  active_element.src = "MMM-SMP-Simple-Music-Player/play.svg";
                  this.sendSocketNotification("PAUSEFILE",'');
                } else if(this.config.playerstate == "paused"){
                  this.config.playerstate = "playing";
                  active_element.src = "MMM-SMP-Simple-Music-Player/pause.svg";
                  this.sendSocketNotification("RESUMEFILE");
                }
                break;

              case "back":
                this.config.current_song--;
                if(this.config.current_song < 0) this.config.current_song = 0;
                document.getElementById("currentsong_text").innerHTML = this.config.playlist[this.config.current_song].title + " - " + this.config.playlist[this.config.current_song].interpret;
                if(this.config.playerstate == "playing"){
                  this.sendSocketNotification("LOADFILE", this.config.current_song);
                }
                break;
              case "next":
                this.config.current_song++;
                if(this.config.current_song == this.config.playlist.length) this.config.current_song = this.config.playlist.length - 1;
                document.getElementById("currentsong_text").innerHTML = this.config.playlist[this.config.current_song].title + " - " + this.config.playlist[this.config.current_song].interpret;
                if(this.config.playerstate == "playing"){
                  this.sendSocketNotification("LOADFILE", this.config.current_song);
                }
                break;

              case "stop":
                document.getElementsByClassName("play")[0].src = "MMM-SMP-Simple-Music-Player/play.svg";
                this.config.playerstate = "stopped";
                this.sendSocketNotification("STOPFILE");
                break;
              
              case "source":
                //this.sendSocketNotification("LOADPLAYLIST",'');
                var el = document.getElementById("sourcemenu");
                el.style.visibility = "visible";
                this.config.navistate = "source";
                break;

              case "volume":
                this.config.navistate = "volume";
                document.getElementById("inner_volume_slider").style.backgroundColor = "#FFFFFF";
                document.getElementById("volume_progressbar").style.border = "2px solid #fff";
                break;
            }
            break;

          case "volume":
            this.config.navistate = "ground";
            document.getElementById("inner_volume_slider").style.backgroundColor = "#000000";
            document.getElementById("volume_progressbar").style.border = "2px solid #000";
            break;

          case "source":
            if(this.source_menu_selected == 0) {
              var el = document.getElementById("sourcemenu");
              el.style.visibility = "hidden";
              this.config.navistate = "ground";
            } else {
              switch(this.getMenuEntryByIndex(this.source_menu_selected, this.source_menu).actiontype){
                case "playlist":
                  this.sendSocketNotification("LOADPLAYLIST", this.getMenuEntryByIndex(this.source_menu_selected, this.source_menu).innerHTML);
                  break;
              }
            }
            break;
        }
        break;
    }
  },

  socketNotificationReceived: function(notification, payload) {
    var self=this;
    switch(notification){
      case "INITIALIZE":
        self.playlists = payload.playlists;
        Log.log("PlaylistList: "+self.playlists.length);
        self.buildSourceMenu(self.source_menu);
        break;
      case "LOADEDPLAYLIST":
        this.config.playlist = payload.playlist;
        this.config.current_song = 0;
        document.getElementById("currentsong_text").innerHTML = this.config.playlist[0].title + " - " + this.config.playlist[0].interpret;
        document.getElementById("sourcetext").innerHTML = payload.name;
        //Log.log("/////////////////// LOADEDPLAYLIST length: "+ payload.length);
        break;
      case "PLAYFILE":
        //audioElement = document.getElementById(self.identifier+"_audio");
        var binaryData = [];
        binaryData.push(payload.data);
        var url = window.URL.createObjectURL(new Blob(binaryData, {type: "audio/mpeg"}));
        self.audioElement.load();
        self.audioElement.setAttribute("src", url);
        self.audioElement.volume = 1;
        self.audioElement.play();
        self.currentsong_text.innerHTML = payload.title + " - " + payload.interpret;
        break;
    }
  },

	notificationReceived: function(notification, payload, sender){
    //Log.info("############### Simple Music Player got notification: " + notification+" by sender " + sender);
    /*if(notification === 'DOM_OBJECTS_CREATED'){
      this.hide(10, { lockString: "MMM-Serial-Connector" });
    }*/
    switch(notification) {
      case "NAVIGATE_BACK":
      case "NAVIGATE_FORWARD":
      case "NAVIGATE_OK":
        this.naviAction(notification);
        break;
    }
  },

});
