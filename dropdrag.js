[register_drag_listener, deregister_drag_listener] = (function () {
    var add_px = value => value + "px"
    var remove_px = value => parseInt(value.slice(0, -2))
    var margin_top = el => remove_px(window.getComputedStyle(el).getPropertyValue('margin-top'))
    var margin_left = el => remove_px(window.getComputedStyle(el).getPropertyValue('margin-left'))
    var has_css_class = (element, name) => element.classList.contains(name)
    var dragged_event = (name, ob) => new CustomEvent(name, { detail: { reset_pos: reset_dragged_positioning, dragged: ob } })
    var rect_in_rect = (element1, element2) => {
      var rect1 = element1.getBoundingClientRect(); var rect2 = element2.getBoundingClientRect()
      return rect1.right >= rect2.left && rect1.left <= rect1.right &&
          rect1.bottom >= rect2.top && rect1.top <= rect2.bottom
    } // end utiltiy functions
    var dragged // the thing we're dragging
    var reset_dragged_positioning = _ => {} 
    var drag_listeners = new Map() // key=element, value=did it touch the draggable
    var have_set_global_listeners = false
    var dragElementOffsetX = 0
    var dragElementOffsetY = 0
    if (!have_set_global_listeners) {
      document.addEventListener("mousedown", mouse_event => {
          if (!has_css_class(mouse_event.target, "draggable")) return
          dragged = mouse_event.target
          dragElementOffsetX = mouse_event.offsetX + margin_left(mouse_event.target)
          dragElementOffsetY = mouse_event.offsetY + margin_top(mouse_event.target)
          set_draggable_reset_pos_function()
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
          find_listener_to_give_drop_event()
          dragged = undefined
      })
      have_set_global_listeners = true
    }
    var set_draggable_reset_pos_function = _ => {
      var old_style_position = dragged.style.position
      var old_style_left = dragged.style.left
      var old_style_top = dragged.style.top
      reset_dragged_positioning = function () {
          dragged.style.position = old_style_position ? old_style_position : "unset"
          dragged.style.left = old_style_left ? old_style_left : "unset"
          dragged.style.top = old_style_top ? old_style_top : "unset"
      }
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
              found.dispatchEvent(dragged_event("drag_enter", dragged))
          } else {
              found.dispatchEvent(dragged_event("drag_over", dragged))
          }
          drag_listeners.set(found, true)
      }
      for([listener, _] of drag_listeners) {
          if (listener == found) continue
          if (drag_listeners.get(listener) == true)
              listener.dispatchEvent(dragged_event("drag_leave", dragged))
          drag_listeners.set(listener, false)
      }
    }
    var rect_overlap_size = (rect1, rect2, top, bottom) => {
      var out = rect1[bottom] < rect2[top] || rect1[top] > rect2[bottom]
      if(out) return 0
      var inside = rect1[top] >= rect2[top] && rect1[bottom] <= rect2[bottom]
      var outside = rect1[top] <= rect2[top] && rect1[bottom] >= rect2[bottom]
      var top_diff = rect1[top] <= rect2[top] ? rect1[bottom] - rect2[top] : 0
      var bottom_diff = rect1[bottom] >= rect2[bottom] ? rect2[bottom] - rect1[top] : 0
      if (inside) return rect1.height
      else if (outside) return rect2.height
      else return top_diff + bottom_diff
    }
    var listeners_and_overlap = (dragged, listeners) => {
      var overlap = []
      var d_rect = dragged.getBoundingClientRect()
      for (var i = 0; i < listeners.length; i++) {
          var l_rect = listeners[i].getBoundingClientRect()
          var y_overlap = rect_overlap_size(d_rect, l_rect, "top", "bottom");
          var x_overlap = rect_overlap_size(d_rect, l_rect, "left", "right");
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
      if (listeners_found.length == 0) reset_dragged_positioning()
      else {
          listeners_found[0].dispatchEvent(dragged_event("drag_drop", dragged))
          listeners_found.slice(1).forEach(other => {
              other.dispatchEvent(dragged_event("drag_leave", dragged))
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
      }]
    })()
