import {Component,Input,SimpleChanges,ViewEncapsulation,Renderer,AfterViewInit,ElementRef,OnChanges,OnDestroy,ViewChild} from '@angular/core';
import { NgxGaugeError } from './gauge-error';
import { clamp,coerceBooleanProperty,coerceNumberProperty,cssUnit,isNumber} from '../common/util';

const DEFAULTS = {
    MIN: 0,
    MAX: 100,
    TYPE: 'arch',
    THICK: 25,
    DECIMALS: 2,
    FOREGROUND_COLOR: 'rgba(0, 150, 136, 1)',
    BACKGROUND_COLOR: 'rgba(0, 0, 0, 0.1)',
    CAP: 'butt',
    SIZE: 200
};

export type NgxGaugeType = 'full' | 'arch' | 'semi';
export type NgxGaugeCap = 'round' | 'butt';

@Component({
    selector: 'ngx-gauge',
    templateUrl: 'gauge.html',
    styleUrls: ['gauge.css'],
    host: {
        'role': 'meter',
        '[class.ngx-gauge-meter]': 'true',
        '[attr.aria-valuemin]': 'min',
        '[attr.aria-valuemax]': 'max',
        '[attr.aria-valuenow]': 'value'
    },
    encapsulation: ViewEncapsulation.None
})
export class NgxGauge implements AfterViewInit, OnChanges, OnDestroy {

    @ViewChild('canvas') _canvas: ElementRef;

    private _size: number = DEFAULTS.SIZE;
    private _min: number = DEFAULTS.MIN;
    private _max: number = DEFAULTS.MAX;
    private _decimals: number = DEFAULTS.MAX;
    private _value: number = 0;
    private _initialized: boolean = false;
    private _context: CanvasRenderingContext2D;
    private _lastValue: number = NaN;
    private _foregroundColor: any = DEFAULTS.FOREGROUND_COLOR;
    private _reverse: boolean = false;

    @Input()
    get size(): number { return this._size; }
    set size(value: number) { this._size = coerceNumberProperty(value); }

    @Input()
    get min(): number { return parseFloat(this._min.toFixed(this.decimals)); }
    set min(value: number) { this._min = coerceNumberProperty(value, DEFAULTS.MIN); }

    @Input()
    get max(): number { return parseFloat(this._max.toFixed(this.decimals)); }
    set max(value: number) { this._max = coerceNumberProperty(value, DEFAULTS.MAX); }

    @Input()
    get decimals(): number { return this._decimals; }
    set decimals(value: number) { this._decimals = coerceNumberProperty(value, DEFAULTS.DECIMALS); }

    @Input()
    get reverse(): boolean { return this._reverse; }
    set reverse(value: boolean) { this._reverse = value ? true : false; }

    @Input()
    get value() { return parseFloat(this._value.toFixed(this.decimals)); }
    set value(val: number) {
      this._lastValue = this.value;
      this._value = coerceNumberProperty(val, DEFAULTS.MIN);
    }

    @Input()
    get foregroundColor() { return this._foregroundColor; }
    set foregroundColor(val: any) {
      if(typeof val === 'string'){
        this._foregroundColor = val;
        return;
      }
      else if(typeof val === 'object' && val.length !== undefined){
        let newForegroundColor = [];
        let currentColor, currentValue, inserted;
        for(let i = 0; i < val.length; i++){

          // Check if structure and types are correct
          if(typeof val[i].value === 'number' && typeof val[i].color === 'string' && /#[A-F0-9]{6}/.test(val[i].color)){

            currentValue = val[i].value;
            currentColor = val[i].color;
            inserted = false;

            for(let p = 0; p < newForegroundColor.length; p++){

              // Check if value is lower -> Insert
              if(currentValue < newForegroundColor[p].value){
                newForegroundColor.splice(p,0,val[i]);
                inserted = true;
                break;
              }
            }

            // Is currently the biggest value -> Append
            if(!inserted) newForegroundColor.push(val[i])
          }
        }
        this._foregroundColor = newForegroundColor;
        return;
      }
      this._value = coerceNumberProperty(val, DEFAULTS.MIN);
    }

    @Input() type: NgxGaugeType = DEFAULTS.TYPE as NgxGaugeType;
    @Input() cap: NgxGaugeCap = DEFAULTS.CAP as NgxGaugeCap;
    @Input() thick: number = DEFAULTS.THICK;
    @Input() label: string;
    @Input() append: string;
    @Input() prepend: string;
    @Input() backgroundColor: string = DEFAULTS.BACKGROUND_COLOR;
    @Input() duration: number = 1200;
    @Input() centerFontSize: string = "32px";
    @Input() labelFontSize: string = "20px";

    constructor(private _elementRef: ElementRef, private _renderer: Renderer) { }

    ngOnChanges(changes: SimpleChanges) {
        const isTextChanged = changes['label'] || changes['append'] || changes['prepend'];
        const isDataChanged = changes['value'] || changes['min'] || changes['max'];

        if (this._initialized) {
            if (isDataChanged) {
                this._update();
            } else if (!isTextChanged) {
                this._destroy();
                this._init();
            }
        }
    }

    private _updateSize() {
        this._renderer.setElementStyle(this._elementRef.nativeElement, 'width', cssUnit(this._size));
        this._renderer.setElementStyle(this._elementRef.nativeElement, 'height', cssUnit(this._size));
    }

    ngAfterViewInit() {
        if (this._canvas) {
            this._init();
        }
    }

    ngOnDestroy() {
        this._destroy();
    }

    private minMaxLineHeight(){
      switch(this.type){
        case "full": return (this.size / 10 * 2)  + 'px';
        case "semi": return (this.size / 10 * 13)  + 'px';
        case "arch": return (this.size / 10 * 17)  + 'px';
        default: return (this.size / 10 * 1)  + 'px';
      }
    }

    private minTextAlign(){
      switch(this.type){
        case "full": return "left"
        case "semi": return "left"
        case "arch": return "center"
        default: return "center";
      }
    }

    private maxTextAlign(){
      switch(this.type){
        case "full": return "right"
        case "semi": return "right"
        case "arch": return "center"
        default: return "center";
      }
    }

    private _getBounds(type: NgxGaugeType) {
        let arcStart, arcEnd;
        if (type == 'semi') {
          arcStart = Math.PI;
          arcEnd = 2 * Math.PI;
        } else if (type == 'full') {
          arcStart = 1.5 * Math.PI;
          arcEnd = 3.5 * Math.PI;
        } else if (type === 'arch') {
          arcStart = 0.8 * Math.PI;
          arcEnd = 2.2 * Math.PI;
        }

        return { arcStart, arcEnd };
    }

    private _drawShell(start: number, middle: number, end: number, color: string) {
        let center = this._getCenter(), radius = this._getRadius();

        this._clear();

        this._context.beginPath();
        this._context.strokeStyle = this.backgroundColor;
        this._context.arc(center.x, center.y, radius, this.reverse ? start : middle, this.reverse ? middle : end, false);
        this._context.stroke();

        this._context.beginPath();
        this._context.strokeStyle = color;
        this._context.arc(center.x, center.y, radius, this.reverse ? middle : start, this.reverse ? end : middle, false);
        this._context.stroke();
    }

    private _clear() {
        this._context.clearRect(0, 0, this._getWidth(), this._getHeight());
    }

    private _getWidth() {
        return this.size;
    }

    private _getHeight() {
        return this.size;
    }

    private _getRadius() {
        var center = this._getCenter();
        return center.x - this.thick;
    }

    private _getCenter() {
        var x = this._getWidth() / 2,
            y = this._getHeight() / 2;
        return { x, y };
    }

    private _init() {
        this._context = (this._canvas.nativeElement as HTMLCanvasElement).getContext('2d');
        this._initialized = true;
        this._updateSize();
        this._setupStyles();
        this._create();
    }

    private _destroy() {
        this._clear();
        this._context = null;
    }

    private _setupStyles() {
        this._context.canvas.width = this.size;
        this._context.canvas.height = this.size;
        this._context.lineCap = this.cap;
        this._context.lineWidth = this.thick;
    }

    private _getForegroundColor(value) {
      if(typeof this.foregroundColor === 'string') return this.foregroundColor;
      else if(typeof this.foregroundColor === 'object' && this.foregroundColor.length !== undefined){

        if(this.foregroundColor.length === 0) return DEFAULTS.FOREGROUND_COLOR;
        if(this.foregroundColor.length === 1) return this.foregroundColor[0].color;

        if(this.foregroundColor[0].value > value) return this.foregroundColor[0].color;
        if(this.foregroundColor[this.foregroundColor.length - 1].value < value) return this.foregroundColor[this.foregroundColor.length - 1].color;

        let current = null, next = null, percent, red, green, blue, currentRed, currentGreen, currentBlue, nextRed, nextGreen, nextBlue;
        for(let i = 0; i < this.foregroundColor.length - 1; i++){
          current = this.foregroundColor[i];
          next = this.foregroundColor[i + 1];

          if(value >= current.value && value < next.value){

            // Calculate the difference between both in percent
            percent = (value - current.value) / (next.value - current.value);

            currentRed = parseInt(current.color.slice(1,3),16) * (1 - percent)
            currentGreen = parseInt(current.color.slice(3,5),16) * (1 - percent)
            currentBlue = parseInt(current.color.slice(5),16) * (1 - percent)

            nextRed = parseInt(next.color.slice(1,3),16) * percent
            nextGreen = parseInt(next.color.slice(3,5),16) * percent
            nextBlue = parseInt(next.color.slice(5),16) * percent

            red = Math.floor(currentRed + nextRed)
            green = Math.floor(currentGreen + nextGreen)
            blue = Math.floor(currentBlue + nextBlue)

            red = ("00" + red.toString(16)).slice(-2)
            green = ("00" + green.toString(16)).slice(-2)
            blue = ("00" + blue.toString(16)).slice(-2)

            return "#" + red.toString(16) + green.toString(16) + blue.toString(16)
          }
        }
      }
      else return DEFAULTS.FOREGROUND_COLOR;
    }

    private _create() {
        let self = this
        let type = this.type
        let min = this.min
        let max = this.max
        let bounds = this._getBounds(type)
        let arcStart = bounds.arcStart
        let arcEnd = bounds.arcEnd
        let unit = (bounds.arcEnd - bounds.arcStart) / (max - min)
        let value = clamp(this.value, this.min, this.max)
        let lastValue = clamp(this._lastValue, this.min, this.max)
        let duration = this.duration
        let requestID
        let starttime
        let color = this._getForegroundColor(value)
        let displacement = unit * (value - min)
        let lastDisplacement = lastValue === NaN ? 0 : unit * (lastValue - min)

        function animate(timestamp) {
            timestamp = timestamp || new Date().getTime();
            var runtime = timestamp - starttime;
            var progress = runtime / duration;
            progress = Math.min(progress, 1);

            let _displacementDiff = lastDisplacement - displacement;
            let _displacement = _displacementDiff > 0 ?
              lastDisplacement - (_displacementDiff * progress) :
              lastDisplacement + (_displacementDiff * (-1) * progress)

            let _middle = Math.max(arcStart, arcStart + _displacement)

            self._drawShell(arcStart, _middle, arcEnd, color);
            if (runtime < duration) {
                requestID = window.requestAnimationFrame((timestamp) => animate(timestamp));
            } else {
                window.cancelAnimationFrame(requestID);
            }
        }

        // Calculate new arc after every frame
        window.requestAnimationFrame((timestamp) => {
            starttime = timestamp || new Date().getTime();
            animate(timestamp);
        });
    }

    private _update() {
        this._clear();
        this._create();
    }

}
