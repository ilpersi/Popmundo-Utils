/**
 * color.js
 * Copyright (C) 2007-2009  Tommi Rautava
 * 
 * This file is part of Popomungo.
 *
 * Popomungo is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 * 
 * Popomungo is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

var pm_Color = {
	
	/**
	 * Source of the algorithm:
	 * "HSV color space"
	 * http://en.wikipedia.org/wiki/HSV_color_space
	 */
	convertHsvToRgb: function convertHsvToRgb(H, S, V) {
		if (H == undefined) {
			H = 0;
		}
		
		var Hm = H % 360;
		var Hi = Math.floor( Hm / 60 );
		var f  = ( Hm / 60 ) - Hi;
		
		var p  = V * ( 1 - S );
		var q  = V * ( 1 - f * S );
		var t  = V * ( 1 - ( 1 - f ) * S );
		
		var R = 0;
		var G = 0;
		var B = 0;

		switch (Hi) {
			case 0: R = V; G = t; B = p; break;
			case 1: R = q; G = V; B = p; break;
			case 2: R = p; G = V; B = t; break;
			case 3: R = p; G = q; B = V; break;
			case 4: R = t; G = p; B = V; break;
			case 5: R = V; G = p; B = q; break;
		};
		
		R = Math.round(R * 255);
		G = Math.round(G * 255);
		B = Math.round(B * 255);
		
		return new pm_RGB(R, G, B);
	},
	
	
	/**
	 * @param RGB	A hex color string, for example "#abcdef".
	 *  
	 * Source of the algorithm: 
	 * "Color Conversion Algorithms"
	 * by Nan C. Schaller
	 * http://www.cs.rit.edu/~ncs/color/t_convert.html
	 */
	convertRgbToHsv: function convertRgbToHsv(RGB) {
		var r = parseInt('0x'+ RGB.substr(1, 2)) / 255;
		var g = parseInt('0x'+ RGB.substr(3, 2)) / 255;
		var b = parseInt('0x'+ RGB.substr(5, 2)) / 255;

		// r, g, b, s, v = [0,1]
	 	// h = [0,360]
	
		var v = Math.max(Math.max(r, g), b);
	
		if ( v == 0 ) {
			// r = g = b = 0 (black)
			return new pm_HSV(undefined, 0, 0);
		}

		var delta = v - Math.min(Math.min(r, g), b);

		if (delta == 0) {
			// r = g = b (gray)
			return new pm_HSV(undefined, 0, v);
		}
	
		var s = delta / v;
	
		var h;
		if	( r == v ) {
			// between yellow & magenta
			h = ( g - b ) / delta;
		}
		else if	( g == v ) {
			// between cyan & yellow
			h = 2 + ( b - r ) / delta;
		}
		else {
			// between magenta & cyan
			h = 4 + ( r - g ) / delta;
		}
	
		// degrees
		h = h * 60;
		
		if	( h < 0 ) {
			h = h + 360;
		}	

		return new pm_HSV(h, s, v);
	},
	
	
	/**
	 * Source of the algorithm / code snippet: 
	 * "Determining Ideal Text Color Based on Specified Background Color"
	 * by John Simmons
	 * http://www.codeproject.com/cs/media/IdealTextColor.asp
	 */
	idealTextColor: function idealTextColor(r, g, b) {
    	var nThreshold = 150;
    	var bgDelta = ((r * 0.299) + (g * 0.587) + (b * 0.114)).toFixed(0);

    	if (bgDelta > nThreshold) {
    		return '#000000';
    	}
    	else {
    		return '#FFFFFF';
    	}
	}
};



function pm_HSV(h, s, v) {
	this.H = h;
	this.S = s;
	this.V = v;
};


function pm_RGB(r, g, b) {
	this.R = r;
	this.G = g;
	this.B = b;
};


pm_HSV.prototype.toString = function toString() {
	return 'hsv('+ this.H +','+ this.S +','+ this.V +')'; 
};


pm_RGB.prototype.toString = function toString() {
	return 'rgb('+ this.R +','+ this.G +','+ this.B +')'; 
};


pm_RGB.prototype.toHex = function toHex() {
	var r =	parseInt(this.R).toString(16); 
	var g = parseInt(this.G).toString(16);
	var b = parseInt(this.B).toString(16);
	
	r = (r.length > 1) ? r : '0'+ r;
	g = (g.length > 1) ? g : '0'+ g;
	b = (b.length > 1) ? b : '0'+ b;
	
	return '#'+ r + g + b;
};


/**
 * parseHex (a static class function)
 */ 
pm_RGB.parseHex = function parseHex(rgb) {
	var r = parseInt('0x'+ rgb.substr(1, 2));
	var g = parseInt('0x'+ rgb.substr(3, 2));
	var b = parseInt('0x'+ rgb.substr(5, 2));
	
	return new pm_RGB(r, g, b);
};


function pm_TextColor(text, bg) {
	this.textColor = text;
	this.bgColor = bg;
};


pm_TextColor.prototype.toString = function toString() {
	return 'color: '+ this.textColor +'; background-color: '+ this.bgColor +';'; 
};
