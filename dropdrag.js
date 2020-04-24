function setup_dragging() {
    var remove_px = value => parseInt(value.slice(0, -2))
    var margin_top = el => remove_px(window.getComputedStyle(el).getPropertyValue('margin-top'))
    var margin_left = el => remove_px(window.getComputedStyle(el).getPropertyValue('margin-left'))
    var add_px = value => value + "px"
    var has_css_class = (element, name) => element.classList.contains(name)
    var dragged_event = (name, ob) => new CustomEvent(name, { thing: "yes", detail: { dragged: ob } })
    var rect_in_rect = (element1, element2) => {
        var rect1 = element1.getBoundingClientRect(); var rect2 = element2.getBoundingClientRect()
        return rect1.right >= rect2.left && rect1.left <= rect1.right && 
            rect1.bottom >= rect2.top && rect1.top <= rect2.bottom
    } // end utiltiy functions
    var dragged
    var drag_listeners = new Map() // key=element, value=did it touch the draggable
    var have_set_global_listeners = false

    if(!have_set_global_listeners) {
        document.addEventListener("mousedown", mouse_event => {
            if(!has_css_class(mouse_event.target, "draggable")) return
            dragged = mouse_event.target
            set_dragged_offset(mouse_event)
            set_draggable_reset_pos_function()
        })
        document.addEventListener("mousemove", mouse_event => {
            if(!dragged) return
            if(mouse_event.buttons <= 0 || !dragged) return
            move_fixed_pos_dragged(mouse_event)
            fire_events_if_dragged_touches_listeners()
            mouse_event.preventDefault()
        })
        document.addEventListener("mouseup", e => {
            if(!dragged) return
            fire_drop_event_or_return_to_orig_pos()
            dragged = undefined
        })
        have_set_global_listeners = true
    }

    var set_dragged_offset = mouse_event => {
        dragged.dragElementOffsetX = mouse_event.offsetX + margin_left(mouse_event.target)
        dragged.dragElementOffsetY = mouse_event.offsetY + margin_top(mouse_event.target)
    }
    var set_draggable_reset_pos_function = _ => {
        var old_style_position = dragged.style.position
        var old_style_left = dragged.style.left
        var old_style_top = dragged.style.top
        dragged.reset_positioning = function() {
            dragged.style.position = old_style_position ? old_style_position : "unset"
            dragged.style.left = old_style_left ? old_style_left : "unset"
            dragged.style.top = old_style_top ? old_style_top : "unset"
        }
    }
    var move_fixed_pos_dragged = mouse_event => {
        dragged.style.top = add_px(mouse_event.clientY - dragged.dragElementOffsetY)
        dragged.style.left = add_px(mouse_event.clientX - dragged.dragElementOffsetX)
        dragged.style.position = "fixed"
    }
    var fire_events_if_dragged_touches_listeners = _ => {
        for(var [listener, was_previously_hit] of drag_listeners) {
            var hit_listener = rect_in_rect(listener, dragged)
            if(hit_listener && !was_previously_hit) {
                listener.dispatchEvent(dragged_event("drag_enter", dragged))
            } else if(hit_listener) {
                listener.dispatchEvent(dragged_event("drag_over", dragged))
            } else if(!hit_listener && was_previously_hit) {
                listener.dispatchEvent(dragged_event("drag_leave", dragged))
            } 
            drag_listeners.set(listener, hit_listener)
        }
    }
    var rect_overlap_size = (d_rect, l_rect, top, bottom) => {
        var inside  = d_rect[top] >= l_rect[top] && d_rect[bottom] <= l_rect[bottom]
        var outside = d_rect[top] <= l_rect[top] && d_rect[bottom] >= l_rect[bottom]
        var top_diff = d_rect[top] <= l_rect[top] ? d_rect[bottom] - l_rect[top] : 0
        var bottom_diff = d_rect[bottom] >= l_rect[bottom] ? l_rect[bottom] - d_rect[top] : 0
        if(inside) return d_rect.height
        else if(outside) return l_rect.height
        else return top_diff + bottom_diff
    }
    var find_listener_with_most_overlap = (dragged, listeners) => {
        var most_overlap = [listeners[0], 0]
        var d_rect = dragged.getBoundingClientRect()
        for(var i=0; i < listeners.length; i++) {
            var l_rect = listeners[i].getBoundingClientRect()
            var y_overlap = rect_overlap_size(d_rect, l_rect, "top", "bottom");
            var x_overlap = rect_overlap_size(d_rect, l_rect, "left", "right");
            if(x_overlap + y_overlap > most_overlap[1]) most_overlap = [listeners[i], x_overlap + y_overlap]
        }
        return most_overlap[0]
    }
    var fire_drop_event_or_return_to_orig_pos = _ => {
        var listeners_found = []
        for(var [listener, was_previously_hit] of drag_listeners) {
            var hit_listener = rect_in_rect(listener, dragged)
            if(hit_listener) listeners_found.push(listener)
        }
        if(listeners_found.length == 0)  dragged.reset_positioning()
        else {
            var to_drop = find_listener_with_most_overlap(dragged, listeners_found)
            to_drop.dispatchEvent(dragged_event("drag_drop", dragged))
            for(var [listener, was_previously_hit] of drag_listeners) {
                drag_listeners.set(listener, false)
                if(listener != to_drop && was_previously_hit) 
                    listener.dispatchEvent(dragged_event("drag_leave", dragged))
            }
        }
    }

    // function to register a drag listener
    return drag_listener_element => {
        drag_listeners.set(drag_listener_element, false)
        return drag_listener_element
    }
}
