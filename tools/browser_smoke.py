#!/usr/bin/env python3
"""v1.09 mobile/browser smoke test. Run against a local static server URL."""

import json
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8123"

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    )
    context = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
    context.add_init_script("""
      if (!localStorage.getItem('vd.smoke.v109')) {
        localStorage.setItem('vd.profile.v1', JSON.stringify({name:'Smoke',lang:'en',onboarded:true,inverted:false,cardsReversed:false}));
        localStorage.removeItem('ie.curriculum.v2');
        localStorage.setItem('vd.smoke.v109', '1');
      }
    """)
    page = context.new_page()
    errors, failures = [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("requestfailed", lambda request: failures.append(request.url) if "/audio/" not in request.url else None)
    page.goto(BASE, wait_until="networkidle")
    assert page.get_by_role("button").all_text_contents()[1:] == [
        "Vocabulary", "Reading Comprehension", "Middle School English", "High School English", "Memory Palace"
    ]

    routes = ["#/vocab", "#/reading", "#/middle", "#/middle/7", "#/middle/7/mcq", "#/high-school", "#/memory", "#/cloze/7"]
    for route in routes:
        page.goto(f"{BASE}/{route}", wait_until="networkidle")
        page.wait_for_timeout(100)
        assert not page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth"), route

    page.goto(f"{BASE}/#/reading/rc-foundation-u01-a", wait_until="networkidle")
    assert page.locator("article.reading-body p").count() > 0
    assert page.evaluate("document.querySelector('audio').paused && document.querySelector('audio').currentTime === 0")
    assert "Review this reading skill" not in page.locator("main").inner_text()
    page.get_by_role("button", name="Play").click()
    page.locator(".audio-status").filter(has_text="Audio ready offline").wait_for(timeout=30_000)
    page.wait_for_function("document.querySelector('audio').currentSrc.startsWith('blob:')")
    page.wait_for_function("document.querySelector('audio').duration > 0")
    assert "--:--" not in page.locator(".audio-time").inner_text()
    assert page.evaluate("caches.open('vd-audio-v1').then(c => c.match(location.origin + '/audio/readings/rc-foundation-u01-a.m4a')).then(Boolean)")
    page.locator(".audio-player input[type=range]").evaluate("el => { el.value = '500'; el.dispatchEvent(new Event('input', {bubbles:true})); }")
    page.wait_for_function("document.querySelector('audio').currentTime > document.querySelector('audio').duration * .4")
    page.get_by_role("button", name="Restart").click()
    page.wait_for_function("document.querySelector('audio').currentTime < 1")
    page.get_by_role("button", name="Pause").click()
    page.evaluate("""
      const node = document.querySelector('.reading-body p').firstChild;
      const start = node.data.toLowerCase().indexOf('astronomers');
      const range = document.createRange(); range.setStart(node, start); range.setEnd(node, start + 11);
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
      document.querySelector('.reading-body').dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
    """)
    page.wait_for_timeout(100)
    assert page.locator(".lookup-panel:not([hidden])").count() == 1
    page.evaluate("document.querySelector('.reading-body').dispatchEvent(new MouseEvent('mouseup', {bubbles:true}))")
    page.wait_for_timeout(100)
    page.get_by_role("button", name="Submit section").nth(0).click()
    page.get_by_role("button", name="Submit section").nth(1).click()
    page.get_by_role("button", name="Reveal meaning").click()
    page.get_by_role("button", name="I knew it").click()
    page.get_by_role("button", name="Complete lesson").click()
    page.wait_for_timeout(700)
    saved = json.loads(page.evaluate("localStorage.getItem('ie.curriculum.v2')"))
    assert saved["articles"]["rc-foundation-u01-a"]["completedAt"] > 0
    assert len(saved["memory"]) == 1
    memory_item = next(iter(saved["memory"].values()))
    assert memory_item["encounterCount"] == 2
    assert len(memory_item["reviewHistory"]) == 1

    page.goto(f"{BASE}/#/middle/7/mcq/choose/ms-g7-mcq-001", wait_until="networkidle")
    page.get_by_role("button", name="Study").wait_for(timeout=15_000)
    assert page.get_by_role("button", name="Study").count() == 1
    page.get_by_role("button", name="Test").click()
    page.wait_for_timeout(100)
    assert page.locator(".question-feedback").count() == 0
    page.locator("fieldset.question input").first.click()
    page.get_by_role("button", name="Submit test").click()
    assert page.locator(".question-feedback").count() > 0

    # A reload must retain the lesson state, and both the shell/article data and
    # this previously fetched recording must remain usable without a network.
    page.goto(f"{BASE}/#/reading/rc-foundation-u01-a", wait_until="networkidle")
    page.evaluate("navigator.serviceWorker.ready")
    context.set_offline(True)
    page.reload(wait_until="domcontentloaded")
    page.locator("article.reading-body").wait_for(timeout=15_000)
    assert json.loads(page.evaluate("localStorage.getItem('ie.curriculum.v2')"))["articles"]["rc-foundation-u01-a"]["completedAt"] > 0
    page.get_by_role("button", name="Play").click()
    page.locator(".audio-status").filter(has_text="Audio ready offline").wait_for(timeout=10_000)
    page.get_by_role("button", name="Pause").click()

    assert not errors, errors
    assert not [url for url in failures if "/content/manifest.json" not in url], failures

    tablet = browser.new_context(viewport={"width": 834, "height": 1194}, has_touch=True, is_mobile=True)
    tablet.add_init_script("""
      localStorage.setItem('vd.profile.v1', JSON.stringify({name:'测试',lang:'zh',onboarded:true,inverted:false,cardsReversed:false}));
    """)
    zh = tablet.new_page()
    zh_errors = []
    zh.on("pageerror", lambda error: zh_errors.append(str(error)))
    zh.goto(BASE, wait_until="networkidle")
    assert zh.get_by_role("button").all_text_contents()[1:] == ["词汇", "阅读理解", "初中英语", "高中英语", "记忆宫殿"]
    for route in ("#/reading", "#/middle/9", "#/high-school", "#/memory"):
        zh.goto(f"{BASE}/{route}", wait_until="networkidle")
        zh.wait_for_timeout(150)
        assert not zh.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth"), route
    assert not zh_errors, zh_errors
    tablet.close()

    print("browser smoke: PASS")
    browser.close()
