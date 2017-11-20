import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  constructor(){
    this.Math = Math;
    setInterval(() => this.value = this.getRandomInt(0,100000) / 100,1000)
  }

  getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  value = 5;
  title = 'app';
  Math: any;
  MultiColor = [
    { value: 0, color: "#00FF00" },
    { value: 700, color: "#FFFF00" },
    { value: 1000, color: "#FF0000" }
  ]
  MultiColorSteps = [
    { value: 0, color: "#00FF00" },
    { value: 700, color: "#00FF00" },
    { value: 700, color: "#FFFF00" },
    { value: 900, color: "#FFFF00" },
    { value: 900, color: "#FF0000" },
    { value: 1000, color: "#FF0000" }
  ]
}
