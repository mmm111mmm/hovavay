/**
 * Call register_drag_listener() on an element
 * and that element receive "drag_enter", "drag_leave", "drag_over", "drag_drop" events
 * with { dragged: the_elements_thats_dragged, start_pos: start_bounding_rect_plus_stye_left_top_position } 
 * as the event's `detail` param.
 *
 * Elements with the `dragged` css class will be dragged. They will received "drag_start"
 * "drag_end" and "drag_fail" events - the last one if it found no place to be dropped - with the same detail object above.
 */
[register_drag_listener, deregister_drag_listener] = (function () {
    var add_px = value => value + "px"
    var remove_px = value => parseInt(value.slice(0, -2))
    var margin_top = el => remove_px(window.getComputedStyle(el).getPropertyValue('margin-top'))
    var margin_left = el => remove_px(window.getComputedStyle(el).getPropertyValue('margin-left'))
    var has_css_class = (element, name) => element.classList.contains(name)
    var dragged_event = name => new CustomEvent(name, { detail: { dragged: dragged, start_pos: start_drag_pos } })
    var rect_in_rect = (element1, element2) => {
        var rect1 = element1.getBoundingClientRect(); var rect2 = element2.getBoundingClientRect()
        return rect1.right >= rect2.left && rect1.left <= rect1.right &&
            rect1.bottom >= rect2.top && rect1.top <= rect2.bottom
    } // end utiltiy functions
    var dragged // the thing we're dragging
    var drag_listeners = new Map() // key=element, value=did it touch the draggable
    var start_drag_pos; // in form of getBoundingClientRect plus left, top and position
    var have_set_global_listeners = false
    var dragElementOffsetX = 0
    var dragElementOffsetY = 0
    if (!have_set_global_listeners) {
        document.addEventListener("mousedown", mouse_event => {
            if (!has_css_class(mouse_event.target, "draggable")) return
            start_drag_pos = mouse_event.target.getBoundingClientRect()
            start_drag_pos.left = mouse_event.target.left
            start_drag_pos.top = mouse_event.target.top
            start_drag_pos.position = mouse_event.target.position
            dragged = mouse_event.target
            dragged.dispatchEvent(dragged_event("drag_start"))
            dragElementOffsetX = mouse_event.offsetX + margin_left(mouse_event.target)
            dragElementOffsetY = mouse_event.offsetY + margin_top(mouse_event.target)
            mouse_event.preventDefault()
        })
        document.addEventListener("mousemove", mouse_event => {
            if (mouse_event.buttons <= 0 || !dragged) return
            move_fixed_pos_dragged(mouse_event)
            fire_events_if_dragged_touches_listeners()
            mouse_event.preventDefault()
        })
        document.addEventListener("mouseup", e => {
            if (!dragged) return
            dragged.dispatchEvent(dragged_event("drag_end"))                  
            find_listener_to_give_drop_event()
            dragged = undefined
            start_drag_pos = undefined
        })
        have_set_global_listeners = true
    }
    var move_fixed_pos_dragged = mouse_event => {
        dragged.style.top = add_px(mouse_event.clientY - dragElementOffsetY)
        dragged.style.left = add_px(mouse_event.clientX - dragElementOffsetX)
        dragged.style.position = "fixed"
    }
    var fire_events_if_dragged_touches_listeners = _ => {
        var listeners_found = listeners_with_overlap()
        var found;
        if(listeners_found.length != 0) {
            var found = listeners_found[0]
            if (drag_listeners.get(found) == false) {
                found.dispatchEvent(dragged_event("drag_enter"))
            } else {
                found.dispatchEvent(dragged_event("drag_over"))
            }
            drag_listeners.set(found, true)
        }
        for([listener, _] of drag_listeners) {
            if (listener == found) continue
            if (drag_listeners.get(listener) == true)
                listener.dispatchEvent(dragged_event("drag_leave"))
            drag_listeners.set(listener, false)
        }
    }
    var rect_overlap_size = (rect1, rect2, top, bottom, height) => {
        var out = rect1[bottom] < rect2[top] || rect1[top] > rect2[bottom]
        if(out) return 0
        var inside = rect1[top] >= rect2[top] && rect1[bottom] <= rect2[bottom]
        var outside = rect1[top] <= rect2[top] && rect1[bottom] >= rect2[bottom]
        var top_diff = rect1[top] <= rect2[top] ? rect1[bottom] - rect2[top] : 0
        var bottom_diff = rect1[bottom] >= rect2[bottom] ? rect2[bottom] - rect1[top] : 0
        if (inside) return rect1[height]
        else if (outside) return rect2[height]
        else return top_diff + bottom_diff
    }
    var listeners_and_overlap = (dragged, listeners) => {
        var overlap = []
        var d_rect = dragged.getBoundingClientRect()
        for (var i = 0; i < listeners.length; i++) {
            var l_rect = listeners[i].getBoundingClientRect()
            var y_overlap = rect_overlap_size(d_rect, l_rect, "top", "bottom", "height");
            var x_overlap = rect_overlap_size(d_rect, l_rect, "left", "right", "width");
            if(x_overlap == 0 || y_overlap == 0) overlap.push([listeners[i], 0])
            else overlap.push([listeners[i], x_overlap + y_overlap])
        }
        return overlap.sort((a, b) => {
            if(a[1] > b[1]) return -1
            else if(a[1] < b[1]) return 1
            else return 0                 
        })
    }
    var listeners_with_overlap = _ => {
        return listeners_and_overlap(dragged, [...drag_listeners.keys()])
        .filter(lo => lo[1] > 0).map(lo => lo[0])
    }
    var find_listener_to_give_drop_event = _ => {
        var listeners_found = listeners_with_overlap()
        if (listeners_found.length == 0) dragged.dispatchEvent(dragged_event("drag_fail"))
        else {
            listeners_found[0].dispatchEvent(dragged_event("drag_drop"))
            listeners_found.slice(1).forEach(other => {
                other.dispatchEvent(dragged_event("drag_leave"))
            })
        }
        for([listener, _] of drag_listeners) drag_listeners.set(listener, false)
    }
    return [
        drag_listener_element => { // register drag listener
            drag_listeners.set(drag_listener_element, false)
            return drag_listener_element
        },
        drag_listener_element => { // deregister drag listener
            drag_listeners.remove(drag_listener_element)
            return drag_listener_element
        }]
})()

/**
 * Give it a vertical list <div><div>a</div><div>b</div></div>, and a floating dragged element.
 * update(): A margin-bottom (of the size of dragged) will be added to a list element below the dragged element
 * reset(): reset all the margin modification
 * insert(): Dragged element will be insert into the dom, below the position found in update()
 * hover_rearrange_callback: implement all the margin rearrangement yourself
 **/
function rearrangeable_vertical_list({list_parent, dragged, hover_rearrange_callback}) {
    var create_margin_rearrange_list_space = _ => {
        var add_px = text => text + "px"
        var remove_px = text => parseInt(text.slice(0, -2))
        var margin_top_bottom = el =>
        remove_px(window.getComputedStyle(el).getPropertyValue('margin-top')) + remove_px(window.getComputedStyle(el).getPropertyValue('margin-bottom'))
        var height_of_dragged = dragged.offsetHeight + margin_top_bottom(dragged)
        var reset_margin_fn = _ => {}
        return ({finish_rearrange, above_dragged_element, is_above_first}) => {
            reset_margin_fn()
            if(finish_rearrange) return
            else if (is_above_first) {
                var old_top = above_dragged_element.style.marginTop
                reset_margin_fn = _ => above_dragged_element.style.marginTop = old_top
                above_dragged_element.style.marginTop = add_px(height_of_dragged)
            } else {
                var old_bottom = above_dragged_element.style.marginBottom
                reset_margin_fn = _ => above_dragged_element.style.marginBottom = old_bottom
                above_dragged_element.style.marginBottom = add_px(height_of_dragged)
            }
        }
    }
    if(!hover_rearrange_callback) hover_rearrange_callback = create_margin_rearrange_list_space()
    var rect_middle = r => r.top + (r.height / 2)
    var offset_middle = el =>  el.offsetTop + (el.offsetHeight / 2) 
    var list = [...list_parent.children].filter(c => c != dragged)
    var element_above_the_dragged = _ => {
        var top_side = dragged.offsetTop
        var middle_side = offset_middle(dragged)
        for (var i = 0; i < list.length; i++) {
            var r = list[i].getBoundingClientRect(); var r1;
            if(list[i+1]) r1 = list[i+1].getBoundingClientRect()
            var item_top = r.top 
            var item_middle = rect_middle(r)
            var next_item_middle = r1 ? rect_middle(r1) : 0
            if (i == list.length - 1 && middle_side >= item_middle) {
                return list[i] // last item
            } else if (next_item_middle && middle_side >= item_middle && middle_side < next_item_middle) {
                return list[i] // past middle of other
            } else if (i == 0 && (middle_side <= item_middle || top_side <= item_top)) {
                return undefined // before first
            }
        }
        alert("error")
    }
    return { 
        update: _ => {
            var above_dragged_element = element_above_the_dragged()
            hover_rearrange_callback({finish_rearrange: false, 
                        above_dragged_element: above_dragged_element ? above_dragged_element : list[0],
                        is_above_first: !above_dragged_element }) 
        }, 
        insert: _ => {
            var above_dragged_element = element_above_the_dragged()
            hover_rearrange_callback({finish_rearrange: true}) 
            if (above_dragged_element == undefined) {
                list_parent.insertBefore(dragged, list[0])
            } else {
                list_parent.insertBefore(dragged, above_dragged_element.nextSibling)
            } 
        },
        reset: _ => hover_rearrange_callback({finish_rearrange: true}) 
    }
}
