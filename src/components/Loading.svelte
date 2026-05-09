<script>
  const letters = 'Retroscope'.split('')
</script>

<div class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#09090f]">
  <div class="flex items-end">
    {#each letters as letter, i}
      <span
        class="letter text-5xl font-black inline-block"
        style="
          animation-delay: {i * 0.09}s;
          background: linear-gradient(90deg, #ffffff 0%, #a5b4fc 40%, #e879f9 70%, #ffffff 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        "
      >{letter}</span>
    {/each}
  </div>
  <p class="text-white/20 text-xs font-semibold mt-6 tracking-widest"
    style="animation: fadeIn 0.4s ease both; animation-delay: 1.1s">
    your feedback has been received and ignored.
  </p>
</div>

<style>
  .letter {
    opacity: 0;
    animation: letterFall 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes letterFall {
    0% {
      opacity: 0;
      transform: translateY(-110px) rotate(-200deg) scale(0.4);
    }
    65% {
      opacity: 1;
      transform: translateY(12px) rotate(8deg) scale(1.08);
    }
    82% {
      transform: translateY(-6px) rotate(-3deg) scale(0.97);
    }
    100% {
      opacity: 1;
      transform: translateY(0px) rotate(0deg) scale(1);
    }
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
